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
//   delWhere('table', 'user_col', '<row filter>', '...')
//   soft('table', 'user_col', 'soft_col', '...')
//   retain('table', '...')
//
// The `delWhere` row filter is checked too, not waved through: it must be made only of
// `<column> IS [NOT] NULL` clauses joined by AND/OR, and every column in it must exist on that
// table in schema.sql. Anything else fails the build rather than reaching the database.
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
  if (/\b(?:del|delWhere|soft|retain)\(\s*"/.test(src)) {
    throw new Error(
      'Double-quoted registry literals are not supported by this validator; use single-quoted literals or extend parseRegistry().',
    );
  }

  const refs = [];

  const reDel = /\bdel\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
  // delWhere('table', 'user_column', '<row filter>', 'note') — the filter is captured so its
  // columns can be checked against schema.sql like any other column reference.
  const reDelWhere = /\bdelWhere\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g;
  const reSoft = /\bsoft\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g;
  const reRetain = /\bretain\(\s*'([^']+)'/g;
  // pseudo('table', 'user_column', ['cleared', 'columns'], 'note') — the third argument is an array,
  // captured whole so each column inside it can be checked against schema.sql like any other.
  const rePseudo = /\bpseudo\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([^\]]*)\]/g;

  let m;
  while ((m = reDel.exec(src)) !== null) {
    refs.push({ table: m[1], userColumn: m[2], action: 'delete' });
  }
  while ((m = reDelWhere.exec(src)) !== null) {
    refs.push({ table: m[1], userColumn: m[2], rowFilter: m[3], action: 'delete' });
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

function readCoverageAllowlist() {
  const file = path.join(root, 'scripts', 'deletion-coverage-allowlist.json');
  if (!fs.existsSync(file)) return new Set();
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Set(Object.keys(parsed.unclassifiedTables ?? {}));
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

  // ---------------------------------------------------------------------------------------------
  // Direction 2: schema -> registry. Everything above asks "does what the registry names exist?".
  // Nothing asked the question that actually matters for a member: "is every table holding my id
  // accounted for when I delete my account?" It was not — 64 tables with a user column appeared in
  // no registry entry at all, including lighthouse_matches (who sought housing from whom) and
  // mood_submissions. Those are recorded in deletion-coverage-allowlist.json as a burn-down list,
  // and this check fails on anything new so the gap can only shrink.
  const coverage = readCoverageAllowlist();
  const referenced = new Set(refs.map((r) => r.table));
  const uncovered = [];
  for (const [table, cols] of schemaTables.entries()) {
    const userColumns = [...cols].filter((c) => /user_id$/.test(c)).sort();
    if (userColumns.length === 0 || referenced.has(table)) continue;
    if (coverage.has(table)) continue;
    uncovered.push({ table, userColumns });
  }
  for (const item of uncovered) {
    fail(
      `table "${item.table}" has user column(s) ${item.userColumns.join(', ')} but no account-deletion ` +
        `registry entry — a member deleting their account would leave these rows behind. Classify it in ` +
        `lib/account/deletion-registry.ts (del / soft / pseudonymize / retain).`,
    );
  }
  // The allowlist may only shrink: an entry that no longer needs to be there is a finished burn-down
  // step, and leaving it would quietly re-open the door for that table later.
  const stillUnclassified = new Set(uncovered.map((u) => u.table));
  for (const table of coverage) {
    const cols = schemaTables.get(table);
    if (!cols) {
      fail(`allowlisted table "${table}" no longer exists in schema.sql — remove it from deletion-coverage-allowlist.json.`);
      continue;
    }
    if (referenced.has(table)) {
      fail(
        `table "${table}" is now classified in the deletion registry but is still listed in ` +
          `deletion-coverage-allowlist.json — remove it from the allowlist.`,
      );
    }
    void stillUnclassified;
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
    if (ref.rowFilter) {
      // The filter reaches the database as literal SQL, so it is held to a grammar small enough to
      // read at a glance: `<column> IS NULL` / `<column> IS NOT NULL`, joined by AND/OR, nothing
      // else. No subqueries, no comparisons against values, no parameters of its own.
      const clauseRe = /^([a-z_][a-z0-9_]*)\s+IS\s+(?:NOT\s+)?NULL$/i;
      const clauses = ref.rowFilter.split(/\s+(?:AND|OR)\s+/i);
      for (const clause of clauses) {
        const parsed = clause.trim().match(clauseRe);
        if (!parsed) {
          fail(
            `table "${ref.table}" has a row filter clause this validator does not accept: "${clause.trim()}". ` +
              `Only "<column> IS NULL" / "<column> IS NOT NULL" joined by AND/OR are allowed.`,
          );
          continue;
        }
        if (!cols.has(parsed[1])) {
          fail(`table "${ref.table}" does not have column "${parsed[1]}" (used in its delete row filter).`);
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
