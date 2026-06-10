#!/usr/bin/env node
/**
 * generate:demo-schema — regenerates schema.demo.sql from schema.sql plus the
 * post migrations in db/migrations/post/.
 *
 * schema.demo.sql is a pre-processed copy of schema.sql ready to paste
 * directly into the Neon console SQL editor. It:
 *   - Sets search_path = demo, public at the top
 *   - Applies all demo transforms (retargets public.* qualifiers,
 *     suppresses public.users block, retargets table_schema guards)
 *   - Appends every db/migrations/post/*.sql (transformed the same way), so the
 *     demo schema receives the same column renames/drops production does —
 *     without this, a legacy demo table can keep a retired NOT NULL column
 *     (e.g. display_name) and reject inserts that production accepts.
 *
 * Run this whenever schema.sql or a post migration changes:
 *   node scripts/generateDemoSchema.mjs
 *
 * Transforms (mirrors migrateToDemo.mjs applyDemoTransforms):
 *   H1/H2: public.chyme_room_members / public.chyme_messages → unqualified
 *   H3:    public.users ALTER TABLE suppressed
 *   H4:    public.users unique-index DO block suppressed
 *   H5:    table_schema = 'public' → table_schema = 'demo'
 *   H6:    public.socketrelay_user_extension → unqualified (post migration 0003)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
const postMigrationsDir = path.resolve(__dirname, '..', 'db', 'migrations', 'post');
const outPath = path.resolve(__dirname, '..', 'schema.demo.sql');

function applyDemoTransforms(sql, targetSchema) {
  sql = sql.replace(/\bpublic\.chyme_room_members\b/g, 'chyme_room_members');
  sql = sql.replace(/\bpublic\.chyme_messages\b/g, 'chyme_messages');
  sql = sql.replace(/\bpublic\.socketrelay_user_extension\b/g, 'socketrelay_user_extension');
  sql = sql.replace(
    /^ALTER TABLE IF EXISTS public\.users\b.*$/gm,
    '-- [demo-skip: public.users alter suppressed]',
  );
  sql = sql.replace(
    /DO \$public_users_username_unique\$[\s\S]*?\$public_users_username_unique\$;/,
    '-- [demo-skip: public.users username unique index suppressed]',
  );
  sql = sql.replace(/table_schema = 'public'/g, `table_schema = '${targetSchema}'`);
  return sql;
}

// Post migrations run after the canonical schema in production (update-neon-db.yml).
// Mirror that here so the demo schema gets the same renames/drops. Files run in
// name order; every one is written to be idempotent.
async function readPostMigrations() {
  let entries;
  try {
    entries = await fs.readdir(postMigrationsDir);
  } catch {
    return '';
  }
  const files = entries.filter((name) => name.endsWith('.sql')).sort();
  let combined = '';
  for (const name of files) {
    const sql = await fs.readFile(path.join(postMigrationsDir, name), 'utf8');
    combined += `\n-- ── post migration: ${name} ──\n${sql}\n`;
  }
  return combined;
}

const header = `-- schema.demo.sql — AUTO-GENERATED from schema.sql
-- DO NOT EDIT MANUALLY. Regenerate with: node scripts/generateDemoSchema.mjs
--
-- How to use (Neon console):
--   1. Open your Neon project → SQL Editor
--   2. Paste this entire file and click Run
--   3. All tables are created inside the \`demo\` schema
--
-- Re-running is safe: every statement uses IF NOT EXISTS / IF EXISTS guards.
-- The demo schema is isolated — unqualified table names resolve to \`demo\`,
-- not \`public\`, so demo writes never touch production rows.

CREATE SCHEMA IF NOT EXISTS demo;
SET search_path = demo, public;

`;

const raw = await fs.readFile(schemaPath, 'utf8');
const postMigrations = await readPostMigrations();
const processed = applyDemoTransforms(raw + postMigrations, 'demo');
await fs.writeFile(outPath, header + processed);

const lines = (header + processed).split('\n').length;
console.log(`schema.demo.sql written (${lines} lines).`);
