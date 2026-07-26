#!/usr/bin/env node

// Orphan v2 table audit (issue #520) — read-only. Computes which live production tables the v3 app
// neither defines nor references, so the owner can review and drop them.
//
// What it does:
//   1. Lists live tables from information_schema (public schema) with approx rows + total size.
//   2. Derives the v3 keep-set from `ctf/schema.sql` (CREATE TABLE IF NOT EXISTS …) — the
//      authoritative definition of what v3 owns. NOTE: `ctf/schema-prod4.6.2026.sql` is a snapshot
//      of production as of April 2026, so it contains the v2 leftovers too — it must NOT be used as
//      a keep-set. It is only consulted to annotate each candidate ("was already present in the
//      4.6.2026 snapshot").
//   3. For every live table not in the keep-set, scans the codebase (`ctf/packages`, `ctf/scripts`,
//      `ctf/schema.sql`, `ctf/schema.demo.sql`) for references. ANY reference (even in a comment)
//      keeps the table — the scan fails toward keeping (`users` is the canonical example: not in
//      schema.sql, but read by v3).
//   4. Prints a classified report and writes two review artifacts next to this script's cwd:
//        - orphan-tables-backup.sh   — pg_dump command for the confirmed-orphan tables
//        - orphan-tables-drop.sql    — BEGIN; DROP TABLE IF EXISTS … CASCADE; COMMIT; (review first)
//
// What it NEVER does: execute a DROP (it only ever runs SELECTs). The generated drop script is a
// review artifact for the owner to run by hand after a fresh backup — per the issue's decision,
// destructive drops stay manual and owner-approved, never auto-applied.
//
// Run (wherever DATABASE_URL is available, e.g. through Infisical):
//   infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
//     node ctf/scripts/audit-orphan-tables.mjs
//
// Offline mode (no database) — audits the issue #520 candidate list against the codebase only:
//   node ctf/scripts/audit-orphan-tables.mjs --offline

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctfRoot = path.resolve(here, '..');

const OFFLINE = process.argv.includes('--offline');

// The high-confidence v2 leftovers from issue #520, used only in --offline mode (the live audit
// derives its candidates from the database instead).
const ISSUE_520_CANDIDATES = [
  // v2 chat
  'chat_groups', 'chat_messages', 'chatgroups_announcements', 'messages',
  // v2 skills (superseded by skills_taxonomy_*)
  'skills_sectors', 'skills_job_titles', 'skills_skills', 'directory_skills',
  // v2 commerce
  'payments', 'pricing_tiers', 'partnerships',
  // v2 ops/feedback
  'feedback_audit', 'feedback_items', 'feedback_votes', 'feedback_inventory_matches',
  'approval_queue', 'implementation_queue', 'inventory_analysis_cache', 'admin_action_logs',
  // v2 moderation/auth/misc
  'moderation_reports', 'reports', 'nps_responses', 'otp_codes', 'auth_tokens', 'sessions',
  'invite_codes', 'exclusions',
  // v2 SupportMatch
  'support_match_profiles', 'supportmatch_announcements',
  // v2 finance snapshots
  'default_alive_or_dead_ebitda_snapshots', 'default_alive_or_dead_financial_entries',
  // needs-explicit-verification list from the issue
  'users', 'announcements', 'socketrelay_profiles', 'trusttransport_profiles', 'trusttransport_ride_requests',
];

function readFileOrDie(p) {
  if (!fs.existsSync(p)) {
    console.error(`Missing required file: ${p}`);
    process.exit(2);
  }
  return fs.readFileSync(p, 'utf8');
}

// The v3 keep-set: every table schema.sql defines.
function schemaKeepSet() {
  const src = readFileOrDie(path.join(ctfRoot, 'schema.sql'));
  const set = new Set();
  for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/g)) {
    set.add(m[1]);
  }
  return set;
}

// Tables present in the April 2026 production snapshot (annotation only — NOT a keep-set).
function prodSnapshotSet() {
  const p = path.join(ctfRoot, 'schema-prod4.6.2026.sql');
  if (!fs.existsSync(p)) return new Set();
  const src = fs.readFileSync(p, 'utf8');
  const set = new Set();
  for (const m of src.matchAll(/CREATE TABLE "([a-z0-9_]+)"/g)) {
    set.add(m[1]);
  }
  return set;
}

// Recursively collect scannable source files. Skips node_modules/build output; includes the two
// schema files so a schema-defined table always counts as referenced.
const SCAN_DIRS = ['packages', 'scripts'];
const SCAN_FILES = ['schema.sql', 'schema.demo.sql'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.expo', 'coverage']);
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.md', '.yaml', '.yml', '.json']);

// This tool names every candidate table itself, so it must never count as a reference.
const SELF = path.join(ctfRoot, 'scripts', 'audit-orphan-tables.mjs');

function collectFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(path.join(dir, entry.name), out);
      continue;
    }
    const full = path.join(dir, entry.name);
    if (full === SELF) continue;
    if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
}

function buildCorpus() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const p = path.join(ctfRoot, dir);
    if (fs.existsSync(p)) collectFiles(p, files);
  }
  for (const f of SCAN_FILES) {
    const p = path.join(ctfRoot, f);
    if (fs.existsSync(p)) files.push(p);
  }
  return files.map((p) => ({ path: path.relative(ctfRoot, p), text: fs.readFileSync(p, 'utf8') }));
}

// Reference scan with two strengths, because several v2 table names are ordinary English words
// (`messages`, `sessions`, `reports`, `payments`) that appear all over the app in unrelated
// identifiers (Stream chat "messages", call "sessions", bug "reports"):
//   - STRONG: the name appears in a SQL context (FROM/JOIN/INTO/UPDATE/DELETE FROM/TABLE …) or as a
//     quoted identifier — real evidence the app touches the TABLE. Any strong hit = keep.
//   - WEAK: the bare word appears somewhere. Weak-only candidates are reported as "likely orphan"
//     but still routed to human review, never to the auto-generated drop list — the scan always
//     fails toward keeping.
function findReferences(corpus, table) {
  const strongRe = new RegExp(
    `(?:\\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\\s+(?:ONLY\\s+)?(?:public\\.)?${table}\\b)|(?:['"\`]${table}['"\`])`,
    'i',
  );
  const weakRe = new RegExp(`\\b${table}\\b`);
  const strong = [];
  const weak = [];
  for (const file of corpus) {
    if (strongRe.test(file.text)) {
      strong.push(file.path);
    } else if (weakRe.test(file.text)) {
      weak.push(file.path);
    }
    if (strong.length >= 5) break; // enough evidence; keep the report short
  }
  return { strong, weak };
}

async function listLiveTables() {
  const { Pool } = await import('pg');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    console.error('DATABASE_URL is required for the live audit. Use --offline to audit the issue #520 candidate list without a database.');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    const result = await pool.query(`
      SELECT t.table_name,
             c.reltuples::bigint AS approx_rows,
             pg_total_relation_size(quote_ident(t.table_name)) AS total_bytes
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name AND c.relkind = 'r'
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);
    return result.rows.map((r) => ({
      table: r.table_name,
      approxRows: Number(r.approx_rows),
      totalBytes: Number(r.total_bytes),
    }));
  } finally {
    await pool.end();
  }
}

function formatBytes(n) {
  if (!Number.isFinite(n)) return '?';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function main() {
  const keep = schemaKeepSet();
  const snapshot = prodSnapshotSet();
  const corpus = buildCorpus();
  console.log(`v3 keep-set: ${keep.size} tables from ctf/schema.sql`);
  console.log(`code corpus: ${corpus.length} files scanned for references`);
  console.log(`prod snapshot (annotation only): ${snapshot.size} tables in ctf/schema-prod4.6.2026.sql`);
  console.log('');

  let candidates;
  if (OFFLINE) {
    console.log(`OFFLINE mode — auditing the ${ISSUE_520_CANDIDATES.length} issue #520 candidates against the codebase only.`);
    candidates = ISSUE_520_CANDIDATES.map((t) => ({ table: t, approxRows: null, totalBytes: null }));
  } else {
    const live = await listLiveTables();
    console.log(`live database: ${live.length} tables in public`);
    candidates = live.filter((t) => !keep.has(t.table));
  }

  const confirmedOrphans = [];
  const likelyOrphans = [];
  const needsReview = [];
  for (const candidate of candidates) {
    if (keep.has(candidate.table)) {
      // Offline list may name a table schema.sql now defines — that is a KEEP, not an orphan.
      needsReview.push({ ...candidate, reason: 'defined in ctf/schema.sql — KEEP', refs: [] });
      continue;
    }
    const { strong, weak } = findReferences(corpus, candidate.table);
    if (strong.length > 0) {
      needsReview.push({ ...candidate, reason: 'SQL-context reference in code — do NOT drop without review', refs: strong });
    } else if (weak.length > 0) {
      likelyOrphans.push({ ...candidate, refs: weak });
    } else {
      confirmedOrphans.push(candidate);
    }
  }

  console.log('');
  console.log(`── Confirmed orphans (zero code references): ${confirmedOrphans.length}`);
  for (const t of confirmedOrphans) {
    const size = t.totalBytes === null ? '' : `  ~${t.approxRows} rows, ${formatBytes(t.totalBytes)}`;
    const snap = snapshot.has(t.table) ? '  [in 4.6.2026 snapshot]' : '';
    console.log(`   ${t.table}${size}${snap}`);
  }

  console.log('');
  console.log(`── Likely orphans (bare-word matches only, no SQL-context use — verify by hand): ${likelyOrphans.length}`);
  for (const t of likelyOrphans) {
    console.log(`   ${t.table}`);
    for (const ref of t.refs.slice(0, 3)) console.log(`       word match: ${ref}`);
  }

  console.log('');
  console.log(`── Needs review (kept): ${needsReview.length}`);
  for (const t of needsReview) {
    console.log(`   ${t.table} — ${t.reason}`);
    for (const ref of t.refs.slice(0, 3)) console.log(`       ref: ${ref}`);
  }

  if (confirmedOrphans.length === 0) {
    console.log('\nNothing to drop. No artifacts written.');
    return;
  }

  // Review artifacts. The drop script is intentionally NOT run by this tool — back up first, read
  // every line, then run it by hand (per issue #520: drops are manual and owner-approved).
  const tables = confirmedOrphans.map((t) => t.table);
  const backup = [
    '#!/usr/bin/env bash',
    '# Backup of the confirmed-orphan tables BEFORE dropping (issue #520). Run with DATABASE_URL set.',
    'set -euo pipefail',
    `pg_dump "$DATABASE_URL" --format=custom --file="orphan-v2-tables-$(date +%Y%m%d).dump" \\`,
    ...tables.map((t, i) => `  --table='public.${t}'${i < tables.length - 1 ? ' \\' : ''}`),
    '',
  ].join('\n');
  const drop = [
    '-- Issue #520: drop confirmed-orphan v2 tables. REVIEW EVERY LINE, back up first',
    '-- (orphan-tables-backup.sh), then run manually. Generated read-only by audit-orphan-tables.mjs;',
    `-- generated against the codebase at ${new Date().toISOString()}.`,
    'BEGIN;',
    ...tables.map((t) => `DROP TABLE IF EXISTS ${t} CASCADE;`),
    'COMMIT;  -- ROLLBACK instead if anything above looks wrong',
    '',
  ].join('\n');

  fs.writeFileSync('orphan-tables-backup.sh', backup, { mode: 0o755 });
  fs.writeFileSync('orphan-tables-drop.sql', drop);
  console.log('\nWrote review artifacts: orphan-tables-backup.sh, orphan-tables-drop.sql');
  console.log('Back up, review, then run the drop script manually. This tool never executes drops.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
