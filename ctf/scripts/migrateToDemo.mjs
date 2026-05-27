#!/usr/bin/env node
/**
 * migrate:demo-schema — provisions a parallel `demo` Postgres schema that mirrors the v3 `public`
 * schema so demo-mode requests land in an isolated namespace without touching production rows.
 *
 * Usage:
 *   DATABASE_URL=<conn> node scripts/migrateToDemo.mjs [--schema=demo]
 *
 * Known schema.sql hazards handled here (see continuity doc for full detail):
 *   1. `public.chyme_room_members` / `public.chyme_messages` ALTER TABLE statements —
 *      schema-qualified to `public`; replaced with unqualified names so search_path routes them
 *      to the target schema instead of prod.
 *   2. `public.users` ALTER TABLE block + the unique-index DO block — Clerk manages `users`;
 *      the demo schema has no `users` table (identity is resolved from request headers/cookies).
 *      These statements are suppressed so they neither fail nor silently modify prod.
 *   3. Extensions (`pgcrypto`) — idempotent and schema-agnostic; left as-is.
 *   4. Views (`skills_taxonomy_dependency_graph`) — already at the end of schema.sql so the
 *      source table exists when the view is created; no special handling needed.
 *   5. Data-migration DO blocks that guard with `table_schema = 'public'` then update unqualified
 *      table names (e.g. lighthouse `move_in_date` → `desired_move_in_date`). The guard is
 *      retargeted to the target schema so a fresh demo table (which never had the old column)
 *      causes the guard to be false and the data migration is correctly skipped.
 *
 * Neon pooler note: Neon's PgBouncer rejects `search_path` in startup options. Pass
 * DATABASE_URL_DIRECT (unpooled endpoint) alongside DATABASE_URL so the demo pool can use
 * `options: '-c search_path=demo,public'`. Falls back to DATABASE_URL when not set.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [rawKey, ...valueParts] = token.slice(2).split('=');
    args[rawKey.trim()] = valueParts.join('=').trim();
  }
  return args;
}

/**
 * Transform schema.sql for execution against the target demo schema.
 * All unqualified table names go to the target schema via search_path.
 * Explicit `public.` qualifiers are retargeted or suppressed as described above.
 */
function applyDemoTransforms(sql, targetSchema) {
  // Retarget public.-qualified chyme tables to unqualified (resolves to demo via search_path)
  sql = sql.replace(/\bpublic\.chyme_room_members\b/g, 'chyme_room_members');
  sql = sql.replace(/\bpublic\.chyme_messages\b/g, 'chyme_messages');

  // Suppress the public.users ALTER TABLE lines (IF EXISTS makes them no-ops, but keeping them
  // explicit would silently target the production users table instead of failing clearly)
  sql = sql.replace(
    /^ALTER TABLE IF EXISTS public\.users\b.*$/gm,
    '-- [demo-skip: public.users alter suppressed]',
  );

  // Suppress the DO block that creates a unique index on public.users
  sql = sql.replace(
    /DO \$public_users_username_unique\$[\s\S]*?\$public_users_username_unique\$;/,
    '-- [demo-skip: public.users username unique index suppressed]',
  );

  // Data-migration DO blocks that guard with `table_schema = 'public'` then update unqualified
  // table names (which resolve to the target schema via search_path). Retarget the guard to the
  // target schema so the check looks at the actual table being modified, not prod.
  sql = sql.replace(/table_schema = 'public'/g, `table_schema = '${targetSchema}'`);

  return sql;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetSchema = (args.schema || 'demo').replace(/[^a-z0-9_]/gi, '');
  if (!targetSchema) throw new Error('--schema value must be a valid identifier');

  const databaseUrl = requireEnv('DATABASE_URL');
  // Neon's PgBouncer pooler rejects search_path in startup options.
  // Use DATABASE_URL_DIRECT (unpooled endpoint) for the provisioning pool.
  // Falls back to DATABASE_URL when not set (non-Neon or direct URL already).
  const directUrl = process.env.DATABASE_URL_DIRECT || databaseUrl;
  const schemaFilePath = path.resolve(__dirname, '..', 'schema.sql');

  const rawSql = await fs.readFile(schemaFilePath, 'utf8');
  const processedSql = applyDemoTransforms(rawSql, targetSchema);

  // Admin pool (no search_path override) — used only to CREATE the schema
  const adminPool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await adminPool.query(`CREATE SCHEMA IF NOT EXISTS ${targetSchema}`);
    console.log(`Schema "${targetSchema}" ready.`);
  } finally {
    await adminPool.end();
  }

  // Demo pool — all unqualified names resolve to the target schema.
  // Must use directUrl (unpooled): Neon's pooler rejects search_path in startup options.
  const demoPool = new Pool({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false },
    options: `-c search_path=${targetSchema},public`,
  });
  try {
    await demoPool.query(processedSql);
    console.log(`Demo schema "${targetSchema}" provisioned successfully.`);
  } finally {
    await demoPool.end();
  }
}

main().catch((err) => {
  console.error('migrate:demo-schema failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
