#!/usr/bin/env node

// Checks the account data-export engine's SQL generation without a database (issue #1264).
//
// The engine (`ctf/packages/web/lib/account/export-engine.ts`) is a pure translator from the
// account deletion registry into read statements:
//   - any table with a userColumn → SELECT * FROM <table> WHERE <userColumn> = $1
//   - retain tables (no userColumn) → (no statement)
//
// Like `check-deletion-engine.mjs`, this extracts the SQL template literal straight from the
// engine source and renders it for every registry entry — so if someone changes the engine's SQL
// (drops the `$1` binding, inlines a value, widens the read past the user's own rows), the
// rendered output changes here and the invariant assertions fail. Plain Node (no TypeScript
// import) so it runs on the CI runners, and it fails closed: an unrecognized registry or engine
// shape stops the check rather than passing silently.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'packages', 'web', 'lib', 'account', 'deletion-registry.ts');
const enginePath = path.join(root, 'packages', 'web', 'lib', 'account', 'export-engine.ts');

let failures = 0;
function fail(message) {
  console.error(`Export engine check failed: ${message}`);
  failures += 1;
}

// Parse the registry's owned-table builder calls in source order. Mirrors the parser in
// check-deletion-engine.mjs, and fails closed on shapes it does not understand.
function parseOwnedTables(src) {
  if (/\{\s*table\s*:/.test(src)) {
    throw new Error(
      'OwnedTable object literals are not supported by this check; use del()/soft()/retain() or extend the parser.',
    );
  }
  if (/\b(?:del|soft|retain)\(\s*"/.test(src)) {
    throw new Error(
      'Double-quoted registry literals are not supported by this check; use single-quoted literals or extend the parser.',
    );
  }

  const callRe = /\b(del|soft|retain)\(\s*'([^']+)'(?:\s*,\s*'([^']+)')?(?:\s*,\s*'([^']+)')?/g;
  const owned = [];
  let m;
  while ((m = callRe.exec(src)) !== null) {
    const [, kind, a, b] = m;
    if (kind === 'del') {
      owned.push({ action: 'delete', table: a, userColumn: b });
    } else if (kind === 'soft') {
      owned.push({ action: 'soft-delete', table: a, userColumn: b });
    } else {
      owned.push({ action: 'retain', table: a });
    }
  }
  return owned;
}

// Pull the SELECT template literal out of the engine source so this check renders the engine's
// real SQL, not a copy. If the engine's SQL shape changes in a way this pattern no longer
// matches, the check fails closed (the engine must be re-read).
function extractEngineTemplate(engineSrc) {
  // select: `SELECT * FROM ${owned.table} WHERE ${owned.userColumn} = $1`
  const selectRe = /`(SELECT \* FROM \$\{owned\.table\} WHERE \$\{owned\.userColumn\} = \$1)`/;
  const sel = engineSrc.match(selectRe);
  if (!sel) {
    throw new Error('could not find the engine SELECT template; the engine SQL shape changed — re-read export-engine.ts.');
  }

  return (owned) =>
    sel[1]
      .replaceAll('${owned.table}', owned.table)
      .replaceAll('${owned.userColumn}', owned.userColumn ?? '');
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
  let selectSql;
  try {
    owned = parseOwnedTables(fs.readFileSync(registryPath, 'utf8'));
    selectSql = extractEngineTemplate(fs.readFileSync(enginePath, 'utf8'));
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
    // Retain tables have no user column, so the export engine must skip them (no statement).
    if (entry.action === 'retain') {
      continue;
    }
    if (!entry.userColumn) {
      fail(`table "${entry.table}" (${entry.action}) has no userColumn — the export cannot scope it.`);
      continue;
    }

    const sql = selectSql(entry);
    statements += 1;

    // Every statement must bind exactly the user id as $1 and no other parameter.
    if (!sql.includes('$1')) {
      fail(`table "${entry.table}" statement does not bind $1: ${sql}`);
    }
    if (sql.includes('$2')) {
      fail(`table "${entry.table}" statement binds more than one parameter: ${sql}`);
    }
    // The read must be scoped to the user's own rows via the bound parameter — never unscoped.
    if (!sql.includes(`WHERE ${entry.userColumn} = $1`)) {
      fail(`table "${entry.table}" does not scope by its user column via $1: ${sql}`);
    }
    if (!sql.startsWith(`SELECT * FROM ${entry.table} `)) {
      fail(`table "${entry.table}" produced unexpected SQL: ${sql}`);
    }
  }

  if (failures > 0) {
    console.error(`Checked ${statements} generated statement(s); see failures above.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Export engine check passed: ${statements} engine-rendered statement(s) validated.`);
}

main();
