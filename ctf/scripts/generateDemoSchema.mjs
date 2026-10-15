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
 *   H6:    public.socket_relay_user_extension → unqualified (post migration 0003)
 *   H7:    a post migration that still reads or writes a public.* table after H1–H6 is left
 *          out (production data repairs; see PRODUCTION_TABLE_ACCESS)
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
  sql = sql.replace(/\bpublic\.socket_relay_user_extension\b/g, 'socket_relay_user_extension');
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

// A post migration that still reads or writes a `public.` table after the transforms above is a
// repair of production data (the login_events backfills, the Unlock spam list restore). The demo
// file is run against the production database by seed-demo.yml, so keeping such a migration in it
// would make a demo reseed read member tables and write production rows. Those files are left out,
// and any later migration written the same way is left out too, rather than relying on somebody to
// add its table to the transforms. `to_regclass('public.…')` existence checks do not match.
const PRODUCTION_TABLE_ACCESS =
  /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE(?:\s+IF\s+EXISTS)?|FROM|JOIN)\s+public\./i;

// Post migrations run after the canonical schema in production (update-neon-db.yml).
// Mirror that here so the demo schema gets the same renames/drops. Files run in
// name order; every one is written to be idempotent.
async function readPostMigrations() {
  let entries;
  try {
    entries = await fs.readdir(postMigrationsDir);
  } catch (err) {
    // A missing post-migrations directory is fine (nothing to append). Any other
    // read error (permissions, I/O) must not be swallowed — silently returning ''
    // would regenerate an incomplete demo schema and reintroduce drift.
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return '';
    }
    throw err;
  }
  const files = entries.filter((name) => name.endsWith('.sql')).sort();
  let combined = '';
  for (const name of files) {
    const sql = await fs.readFile(path.join(postMigrationsDir, name), 'utf8');
    if (PRODUCTION_TABLE_ACCESS.test(applyDemoTransforms(sql, 'demo'))) {
      combined += `\n-- ── post migration: ${name} ──\n-- [demo-skip: names production (public.) tables directly; it repairs production data and has no meaning here]\n`;
      continue;
    }
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
