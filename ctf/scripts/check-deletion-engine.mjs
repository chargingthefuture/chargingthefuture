#!/usr/bin/env node

// Checks the account deletion engine's SQL generation without a database.
//
// The engine (`ctf/packages/web/lib/account/deletion-engine.ts`) is a pure translator from the
// account deletion registry's three actions into SQL:
//   - delete       → DELETE FROM <table> WHERE <userColumn> = $1
//                      (plus ` AND (<rowFilter>)` when the registry narrows the delete)
//   - soft-delete  → UPDATE <table> SET <softDeleteColumn> = NOW()
//                      WHERE <userColumn> = $1 AND <softDeleteColumn> IS NULL
//   - retain       → (no statement)
//
// To actually test the engine (not a re-implementation of it), this script extracts the two SQL
// template literals straight from `deletion-engine.ts` source and renders them for every registry
// entry. So if someone changes the engine's SQL — drops the `$1` binding, removes the soft-delete
// `IS NULL` idempotency guard, inlines a value — the rendered output changes here and the invariant
// assertions below fail. It is plain Node (no TypeScript import, which is unreliable across Node
// versions) so it runs on the Node 20 CI runners, and it fails closed: an unrecognized registry or
// engine shape stops the check rather than passing silently.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'packages', 'web', 'lib', 'account', 'deletion-registry.ts');
const enginePath = path.join(root, 'packages', 'web', 'lib', 'account', 'deletion-engine.ts');

let failures = 0;
function fail(message) {
  console.error(`Deletion engine check failed: ${message}`);
  failures += 1;
}

// Parse the registry's owned-table builder calls in source order. Mirrors the parser in
// check-deletion-registry.mjs, and fails closed on shapes it does not understand.
function parseOwnedTables(src) {
  if (/\{\s*table\s*:/.test(src)) {
    throw new Error(
      'OwnedTable object literals are not supported by this check; use del()/soft()/retain() or extend the parser.',
    );
  }
  if (/\b(?:del|delWhere|soft|softWhenAuthored|releaseClaim|retain)\(\s*"/.test(src)) {
    throw new Error(
      'Double-quoted registry literals are not supported by this check; use single-quoted literals or extend the parser.',
    );
  }

  // softWhenAuthored and releaseClaim carry more arguments than the others and are parsed first, so
  // the shorter `soft(`/`del(` patterns below cannot match a prefix of them.
  const owned = [];
  let m;

  const softAuthoredRe =
    /\bsoftWhenAuthored\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g;
  while ((m = softAuthoredRe.exec(src)) !== null) {
    owned.push({
      action: 'soft-delete',
      table: m[1],
      userColumn: m[2],
      softDeleteColumn: m[3],
      authorColumn: m[4],
      authoredValue: m[5],
    });
  }

  const releaseRe =
    /\breleaseClaim\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([^\]]*)\]/g;
  while ((m = releaseRe.exec(src)) !== null) {
    owned.push({
      action: 'release-claim',
      table: m[1],
      userColumn: m[2],
      authorColumn: m[3],
      authoredValue: m[4],
      clearColumns: [...m[5].matchAll(/'([^']+)'/g)].map((c) => c[1]),
    });
  }

  const callRe = /(?<![A-Za-z])(delWhere|del|soft|retain)\(\s*'([^']+)'(?:\s*,\s*'([^']+)')?(?:\s*,\s*'([^']+)')?/g;
  while ((m = callRe.exec(src)) !== null) {
    const [, kind, a, b, c] = m;
    if (kind === 'del') {
      owned.push({ action: 'delete', table: a, userColumn: b });
    } else if (kind === 'delWhere') {
      owned.push({ action: 'delete', table: a, userColumn: b, rowFilter: c });
    } else if (kind === 'soft') {
      owned.push({ action: 'soft-delete', table: a, userColumn: b, softDeleteColumn: c });
    } else {
      owned.push({ action: 'retain', table: a });
    }
  }
  return owned;
}

// Pull the two SQL template literals out of the engine source so this check renders the engine's
// real SQL, not a copy. We look for the exact template-literal forms the engine uses and convert
// the `${owned.X}` interpolations into a tiny render function. If the engine's SQL shape changes in
// a way these patterns no longer match, the check fails closed (the engine must be re-read).
function extractEngineTemplates(engineSrc) {
  // delete: `DELETE FROM ${owned.table} WHERE ${owned.userColumn} = $1${rowFilter}`
  const deleteRe = /`(DELETE FROM \$\{owned\.table\} WHERE \$\{owned\.userColumn\} = \$1\$\{rowFilter\})`/;
  // ...where rowFilter is built just above it as ` AND (<filter>)`, or '' when there is none. The
  // shape is asserted here so the filter can never replace the user-column match, only narrow it.
  const rowFilterRe = /const rowFilter = owned\.rowFilter \? ` AND \(\$\{owned\.rowFilter\}\)` : '';/;
  // soft-delete is built by concatenating two template chunks; capture both and join them.
  const softRe =
    /`(UPDATE \$\{owned\.table\} SET \$\{owned\.softDeleteColumn\} = NOW\(\) )` \+\s*`(WHERE \$\{owned\.userColumn\} = \$1 AND \$\{owned\.softDeleteColumn\} IS NULL\$\{authored\})`/;
  // release-claim: `UPDATE ${owned.table} SET ${sets.join(', ')} ` +
  //                `WHERE ${owned.userColumn} = $1${authoredClause(owned, '<>')}`
  const releaseRe =
    /`(UPDATE \$\{owned\.table\} SET \$\{sets\.join\(', '\)\} )` \+\s*`(WHERE \$\{owned\.userColumn\} = \$1\$\{authoredClause\(owned, '<>'\)\})`/;
  // The author clause can only ever ADD ` AND <column> <op> '<value>'`; it is asserted here so a
  // change that let it replace the user-column match, or carry anything but a comparison, fails.
  const authoredRe =
    /return ` AND \$\{owned\.authorColumn\} \$\{op\} '\$\{owned\.authoredValue\}'`;/;

  const del = engineSrc.match(deleteRe);
  const soft = engineSrc.match(softRe);
  const release = engineSrc.match(releaseRe);
  if (!del) {
    throw new Error('could not find the engine DELETE template; the engine SQL shape changed — re-read deletion-engine.ts.');
  }
  if (!soft) {
    throw new Error('could not find the engine soft-delete UPDATE template; the engine SQL shape changed — re-read deletion-engine.ts.');
  }
  if (!release) {
    throw new Error(
      'could not find the engine release-claim UPDATE template; the engine SQL shape changed — re-read deletion-engine.ts.',
    );
  }
  if (!rowFilterRe.test(engineSrc)) {
    throw new Error(
      'could not find the engine row-filter clause (` AND (${owned.rowFilter})`); the engine SQL shape changed — re-read deletion-engine.ts.',
    );
  }
  if (!authoredRe.test(engineSrc)) {
    throw new Error(
      "could not find the engine author clause (` AND ${owned.authorColumn} ${op} '${owned.authoredValue}'`); " +
        'the engine SQL shape changed — re-read deletion-engine.ts.',
    );
  }

  const render = (tpl, owned) =>
    tpl
      .replaceAll('${owned.table}', owned.table)
      .replaceAll('${owned.userColumn}', owned.userColumn ?? '')
      .replaceAll('${rowFilter}', owned.rowFilter ? ` AND (${owned.rowFilter})` : '')
      .replaceAll('${owned.softDeleteColumn}', owned.softDeleteColumn ?? '')
      .replaceAll('${authored}', authored(owned, '='))
      .replaceAll("${authoredClause(owned, '<>')}", authored(owned, '<>'))
      .replaceAll("${sets.join(', ')}", sets(owned));

  // Mirrors the engine's own authoredClause / sets construction, so the rendered SQL below is the
  // SQL the engine really produces rather than a hand-written copy of it.
  const authored = (owned, op) =>
    owned.authorColumn && owned.authoredValue ? ` AND ${owned.authorColumn} ${op} '${owned.authoredValue}'` : '';
  const sets = (owned) =>
    [`${owned.userColumn} = NULL`, ...(owned.clearColumns ?? []).map((column) => `${column} = NULL`)].join(', ');

  return {
    deleteSql: (owned) => render(del[1], owned),
    softSql: (owned) => render(soft[1] + soft[2], owned),
    releaseSql: (owned) => render(release[1] + release[2], owned),
  };
}

function main() {
  for (const [label, p] of [['registry', registryPath], ['engine', enginePath]]) {
    if (!fs.existsSync(p)) {
      fail(`${label} not found at ${p}`);
      process.exitCode = 1;
      return;
    }
  }

  let owned;
  let templates;
  try {
    owned = parseOwnedTables(fs.readFileSync(registryPath, 'utf8'));
    templates = extractEngineTemplates(fs.readFileSync(enginePath, 'utf8'));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  if (owned.length === 0) {
    fail('no owned tables parsed from the registry — parser or registry is broken.');
    process.exitCode = 1;
    return;
  }

  let statements = 0;
  for (const entry of owned) {
    if (entry.action === 'retain') {
      continue;
    }

    let sql;
    if (entry.action === 'delete') {
      sql = templates.deleteSql(entry);
    } else if (entry.action === 'release-claim') {
      sql = templates.releaseSql(entry);
    } else {
      sql = templates.softSql(entry);
    }
    statements += 1;

    // Every non-retain statement must bind exactly the user id as $1 and no other parameter.
    if (!sql.includes('$1')) {
      fail(`table "${entry.table}" statement does not bind $1: ${sql}`);
    }
    if (sql.includes('$2')) {
      fail(`table "${entry.table}" statement binds more than one parameter: ${sql}`);
    }
    // The user value must never be inlined — only ever the bound parameter.
    if (!entry.userColumn || !sql.includes(`${entry.userColumn} = $1`)) {
      fail(`table "${entry.table}" does not scope by its user column via $1: ${sql}`);
    }

    if (entry.action === 'delete') {
      if (!sql.startsWith(`DELETE FROM ${entry.table} `)) {
        fail(`delete table "${entry.table}" produced unexpected SQL: ${sql}`);
      }
      // A narrowed delete must ADD a condition, never replace the user-column match — otherwise a
      // filter typo could turn "this member's rows" into "every row that looks like this".
      if (entry.rowFilter && !sql.endsWith(` = $1 AND (${entry.rowFilter})`)) {
        fail(`delete table "${entry.table}" does not AND its row filter onto the user match: ${sql}`);
      }
      if (!entry.rowFilter && !sql.endsWith(' = $1')) {
        fail(`delete table "${entry.table}" has trailing SQL after the user match: ${sql}`);
      }
    }
    if (entry.action === 'soft-delete') {
      if (!entry.softDeleteColumn) {
        fail(`soft-delete table "${entry.table}" has no soft-delete column.`);
      } else if (!sql.includes(`SET ${entry.softDeleteColumn} = NOW()`)) {
        fail(`soft-delete table "${entry.table}" does not stamp its soft-delete column: ${sql}`);
      } else if (!sql.includes(`AND ${entry.softDeleteColumn} IS NULL`)) {
        // Re-running a soft-delete must be a no-op for already-deleted rows.
        fail(`soft-delete table "${entry.table}" is not idempotent (missing IS NULL guard): ${sql}`);
      }
    }
    if (entry.action === 'release-claim') {
      // Releasing must clear the link to this member, or the row stays attached to a gone account.
      if (!sql.includes(`SET ${entry.userColumn} = NULL`)) {
        fail(`release-claim table "${entry.table}" does not clear its user column: ${sql}`);
      }
      // It must also clear everything the member could have filled in personally. A release that
      // keeps those leaves a departed member's own words and wallet addresses on a public listing.
      for (const column of entry.clearColumns ?? []) {
        if (!sql.includes(`${column} = NULL`)) {
          fail(`release-claim table "${entry.table}" does not clear declared column "${column}": ${sql}`);
        }
      }
      // It must never touch a row the member authored — those belong to the soft-delete beside it,
      // and releasing one instead of deleting it would leave their own profile standing.
      if (!sql.endsWith(` AND ${entry.authorColumn} <> '${entry.authoredValue}'`)) {
        fail(`release-claim table "${entry.table}" does not exclude member-authored rows: ${sql}`);
      }
      // Nothing is deleted or stamped by a release.
      if (sql.startsWith('DELETE') || sql.includes('NOW()')) {
        fail(`release-claim table "${entry.table}" deletes or stamps instead of releasing: ${sql}`);
      }
    }
  }

  // A table split by authorship must be covered exactly once: every row either was authored by the
  // member or was not, so the two halves must name the same column and the same value. A mismatch
  // would leave a band of rows that neither statement touches — silently retained on deletion.
  const byTable = new Map();
  for (const entry of owned) {
    if (entry.authorColumn) {
      const seen = byTable.get(entry.table) ?? [];
      seen.push(entry);
      byTable.set(entry.table, seen);
    }
  }
  for (const [table, entries] of byTable) {
    const actions = new Set(entries.map((e) => e.action));
    if (!actions.has('release-claim') || !actions.has('soft-delete')) {
      fail(
        `table "${table}" splits by authorship but does not pair a release-claim with a soft-delete; ` +
          `rows on one side of the split would be left untouched on deletion.`,
      );
      continue;
    }
    const pairs = new Set(entries.map((e) => `${e.authorColumn}|${e.authoredValue}`));
    if (pairs.size !== 1) {
      fail(
        `table "${table}" splits by authorship using more than one column/value pair (${[...pairs].join(', ')}); ` +
          `the two halves must agree or rows fall between them.`,
      );
    }
  }

  if (failures > 0) {
    console.error(`Checked ${statements} generated statement(s); see failures above.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Deletion engine check passed: ${statements} engine-rendered statement(s) validated.`);
}

main();
