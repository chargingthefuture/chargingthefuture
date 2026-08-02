#!/usr/bin/env node

// Validates that ctf/packages/web/lib/account/deletion-registry.ts only references tables and
// columns that actually exist in ctf/schema.sql. This is the guard that stops the account
// deletion registry from drifting away from the real schema (the same drift that already
// happened between the plugin deletion *contracts* and the shipped tables).
//
// It parses schema.sql for table -> column sets, then statically reads the registry's
// `table` / `userColumn` / `softDeleteColumn` string literals and checks each one. It is a
// plain Node script (no TypeScript import) so it runs on any Node version, including the
// Node 20 CI/seed runners.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema.sql');
const registryPath = path.join(root, 'packages', 'web', 'lib', 'account', 'deletion-registry.ts');

function fail(message) {
  console.error(`Deletion registry check failed: ${message}`);
  process.exitCode = 1;
}

// --- Parse schema.sql into { tableName: Set<column> } -----------------------------------------
function parseSchemaColumns(sql) {
  const tables = new Map();
  // Match each CREATE TABLE IF NOT EXISTS <name> ( ... ); block.
  const blockRe = /CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = blockRe.exec(sql)) !== null) {
    const name = m[1];
    const body = m[2];
    const cols = tables.get(name) ?? new Set();
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      // Skip table-level constraints; we only want column definitions.
      if (/^(PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line)) continue;
      const colMatch = line.match(/^([a-z_][a-z0-9_]*)\s+/);
      if (colMatch) cols.add(colMatch[1]);
    }
    tables.set(name, cols);
  }

  // Fold in `ALTER TABLE IF EXISTS <name> ADD COLUMN IF NOT EXISTS <col>` additions.
  const alterRe = /ALTER TABLE IF EXISTS\s+([a-z_][a-z0-9_]*)\s+ADD COLUMN IF NOT EXISTS\s+([a-z_][a-z0-9_]*)/g;
  while ((m = alterRe.exec(sql)) !== null) {
    const [, name, col] = m;
    const cols = tables.get(name) ?? new Set();
    cols.add(col);
    tables.set(name, cols);
  }
  return tables;
}

// --- Extract registry entries from the TypeScript source --------------------------------------
// We read the source text rather than importing the TS module (plain Node can't load .ts
// reliably across versions). The registry must use the single-quoted builder helpers, each of
// which this parser understands:
//   del('table', 'user_col', '...')
//   soft('table', 'user_col', 'soft_col', '...')
//   retain('table', '...')
//
// This parser is deliberately strict and FAILS CLOSED: if the registry ever switches to a shape
// this parser does not understand — a raw `{ table: ... }` object literal, or double-quoted
// builder arguments — it throws instead of silently skipping that entry (which would let an
// unvalidated table slip past CI). Extend this parser if the registry's shape changes on purpose.
function parseRegistry(src) {
  if (/\{\s*table\s*:/.test(src)) {
    throw new Error(
      'OwnedTable object literals are not supported by this validator; use del()/soft()/retain() or extend parseRegistry().',
    );
  }
  if (/\b(?:del|soft|retain)\(\s*"/.test(src)) {
    throw new Error(
      'Double-quoted registry literals are not supported by this validator; use single-quoted literals or extend parseRegistry().',
    );
  }

  const refs = [];

  const reDel = /\bdel\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
  const reSoft = /\bsoft\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g;
  const reRetain = /\bretain\(\s*'([^']+)'/g;
  // pseudo('table', 'user_column', ['cleared', 'columns'], 'note') — the third argument is an array,
  // captured whole so each column inside it can be checked against schema.sql like any other.
  const rePseudo = /\bpseudo\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([^\]]*)\]/g;

  let m;
  while ((m = reDel.exec(src)) !== null) {
    refs.push({ table: m[1], userColumn: m[2], action: 'delete' });
  }
  while ((m = reSoft.exec(src)) !== null) {
    refs.push({ table: m[1], userColumn: m[2], softDeleteColumn: m[3], action: 'soft-delete' });
  }
  while ((m = reRetain.exec(src)) !== null) {
    refs.push({ table: m[1], action: 'retain' });
  }
  while ((m = rePseudo.exec(src)) !== null) {
    const clearColumns = [...m[3].matchAll(/'([^']+)'/g)].map((c) => c[1]);
    refs.push({ table: m[1], userColumn: m[2], clearColumns, action: 'pseudonymize' });
  }
  return refs;
}

function main() {
  if (!fs.existsSync(schemaPath)) {
    fail(`schema.sql not found at ${schemaPath}`);
    return;
  }
  if (!fs.existsSync(registryPath)) {
    fail(`registry not found at ${registryPath}`);
    return;
  }

  const schemaTables = parseSchemaColumns(fs.readFileSync(schemaPath, 'utf8'));

  let refs;
  try {
    refs = parseRegistry(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  if (refs.length === 0) {
    fail('no table references parsed from the registry — parser or registry is broken.');
    return;
  }

  let checked = 0;
  for (const ref of refs) {
    const cols = schemaTables.get(ref.table);
    if (!cols) {
      fail(`table "${ref.table}" is referenced by the registry but does not exist in schema.sql.`);
      continue;
    }
    if (ref.action !== 'retain') {
      if (!ref.userColumn) {
        fail(`table "${ref.table}" has action "${ref.action}" but no user column.`);
      } else if (!cols.has(ref.userColumn)) {
        fail(`table "${ref.table}" does not have column "${ref.userColumn}" (declared as its user column).`);
      }
    }
    if (ref.action === 'pseudonymize') {
      // Every cleared column must exist too. A typo here would silently no-op the part that removes
      // the denormalized handle, leaving the member named after their id was overwritten.
      for (const column of ref.clearColumns ?? []) {
        if (!cols.has(column)) {
          fail(`table "${ref.table}" does not have cleared column "${column}" (declared for pseudonymize).`);
        }
      }
    }
    if (ref.action === 'soft-delete') {
      if (!ref.softDeleteColumn) {
        fail(`table "${ref.table}" is soft-delete but declares no softDeleteColumn.`);
      } else if (!cols.has(ref.softDeleteColumn)) {
        fail(`table "${ref.table}" does not have soft-delete column "${ref.softDeleteColumn}".`);
      }
    }
    checked += 1;
  }

  if (process.exitCode === 1) {
    console.error(`Checked ${checked} registry table reference(s); see failures above.`);
    return;
  }
  console.log(`Deletion registry check passed: ${checked} table reference(s) validated against schema.sql.`);
}

main();
