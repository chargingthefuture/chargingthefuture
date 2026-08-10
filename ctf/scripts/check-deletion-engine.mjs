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
  if (/\b(?:del|delWhere|soft|retain)\(\s*"/.test(src)) {
    throw new Error(
      'Double-quoted registry literals are not supported by this check; use single-quoted literals or extend the parser.',
    );
  }

  const callRe = /\b(delWhere|del|soft|retain)\(\s*'([^']+)'(?:\s*,\s*'([^']+)')?(?:\s*,\s*'([^']+)')?/g;
  const owned = [];
  let m;
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
    /`(UPDATE \$\{owned\.table\} SET \$\{owned\.softDeleteColumn\} = NOW\(\) )` \+\s*`(WHERE \$\{owned\.userColumn\} = \$1 AND \$\{owned\.softDeleteColumn\} IS NULL)`/;

  const del = engineSrc.match(deleteRe);
  const soft = engineSrc.match(softRe);
  if (!del) {
    throw new Error('could not find the engine DELETE template; the engine SQL shape changed — re-read deletion-engine.ts.');
  }
  if (!soft) {
    throw new Error('could not find the engine soft-delete UPDATE template; the engine SQL shape changed — re-read deletion-engine.ts.');
  }
  if (!rowFilterRe.test(engineSrc)) {
    throw new Error(
      'could not find the engine row-filter clause (` AND (${owned.rowFilter})`); the engine SQL shape changed — re-read deletion-engine.ts.',
    );
  }

  const render = (tpl, owned) =>
    tpl
      .replaceAll('${owned.table}', owned.table)
      .replaceAll('${owned.userColumn}', owned.userColumn ?? '')
      .replaceAll('${rowFilter}', owned.rowFilter ? ` AND (${owned.rowFilter})` : '')
      .replaceAll('${owned.softDeleteColumn}', owned.softDeleteColumn ?? '');

  return {
    deleteSql: (owned) => render(del[1], owned),
    softSql: (owned) => render(soft[1] + soft[2], owned),
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

    const sql = entry.action === 'delete' ? templates.deleteSql(entry) : templates.softSql(entry);
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
  }

  if (failures > 0) {
    console.error(`Checked ${statements} generated statement(s); see failures above.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Deletion engine check passed: ${statements} engine-rendered statement(s) validated.`);
}

main();
