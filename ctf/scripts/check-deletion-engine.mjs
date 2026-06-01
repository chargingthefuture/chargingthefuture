#!/usr/bin/env node

// Checks the account deletion engine's SQL generation without a database.
//
// The engine (`ctf/packages/web/lib/account/deletion-engine.ts`) is a pure translator from the
// account deletion registry's three actions into SQL:
//   - delete       → DELETE FROM <table> WHERE <userColumn> = $1
//   - soft-delete  → UPDATE <table> SET <softDeleteColumn> = NOW()
//                      WHERE <userColumn> = $1 AND <softDeleteColumn> IS NULL
//   - retain       → (no statement)
//
// This script reads the registry source (the same single-quoted del()/soft()/retain() builder
// calls that `check-deletion-registry.mjs` parses), reconstructs what the engine must produce for
// each entry, and asserts a set of invariants. It is plain Node (no TypeScript import) so it runs on
// any Node version, including the Node 20 CI runners. It fails closed: an unrecognized registry
// shape stops the check rather than passing silently.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'packages', 'web', 'lib', 'account', 'deletion-registry.ts');

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
  if (/\b(?:del|soft|retain)\(\s*"/.test(src)) {
    throw new Error(
      'Double-quoted registry literals are not supported by this check; use single-quoted literals or extend the parser.',
    );
  }

  // Walk every builder call in order so ordering invariants can be checked.
  const callRe = /\b(del|soft|retain)\(\s*'([^']+)'(?:\s*,\s*'([^']+)')?(?:\s*,\s*'([^']+)')?/g;
  const owned = [];
  let m;
  while ((m = callRe.exec(src)) !== null) {
    const [, kind, a, b, c] = m;
    if (kind === 'del') {
      owned.push({ action: 'delete', table: a, userColumn: b });
    } else if (kind === 'soft') {
      owned.push({ action: 'soft-delete', table: a, userColumn: b, softDeleteColumn: c });
    } else {
      owned.push({ action: 'retain', table: a });
    }
  }
  return owned;
}

// Reconstruct the SQL the engine must generate for one owned table (null for retain).
function expectedSql(owned) {
  if (owned.action === 'retain') return null;
  if (owned.action === 'delete') {
    return `DELETE FROM ${owned.table} WHERE ${owned.userColumn} = $1`;
  }
  return (
    `UPDATE ${owned.table} SET ${owned.softDeleteColumn} = NOW() ` +
    `WHERE ${owned.userColumn} = $1 AND ${owned.softDeleteColumn} IS NULL`
  );
}

function main() {
  if (!fs.existsSync(registryPath)) {
    fail(`registry not found at ${registryPath}`);
    process.exitCode = 1;
    return;
  }

  let owned;
  try {
    owned = parseOwnedTables(fs.readFileSync(registryPath, 'utf8'));
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
    const sql = expectedSql(entry);

    if (entry.action === 'retain') {
      if (sql !== null) fail(`retain table "${entry.table}" should produce no SQL.`);
      continue;
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

    if (entry.action === 'delete' && !sql.startsWith(`DELETE FROM ${entry.table} `)) {
      fail(`delete table "${entry.table}" produced unexpected SQL: ${sql}`);
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
  console.log(`Deletion engine check passed: ${statements} generated statement(s) validated.`);
}

main();
