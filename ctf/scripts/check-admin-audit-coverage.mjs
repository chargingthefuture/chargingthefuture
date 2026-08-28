#!/usr/bin/env node
// Admin audit coverage gate.
//
// WHY THIS EXISTS. Owner directive, 2026-08-28: every admin action is recorded, on every surface,
// from the day the surface ships. The audit trail is what keeps an admin honest in a product with
// one admin, where the person who takes an action is also the only person who could undo it. The
// answer to that is a record, not fewer powers.
//
// It was not true. A sweep on 2026-08-28 found 32 admin routes across 8 surfaces that change data
// and write no durable audit row anywhere — not in the route, not in the library it calls. Five of
// those surfaces have an `audit.ts` that looks like the real thing and is not: it builds the full
// contract-shaped event and ends in `console.info`. A log line on the server is not a record. It is
// not queryable, no screen can read it, it is invisible to the owner, and it ages out of the host's
// retention window. The most consequential example was Directory's profile takedown — the flow a
// person outside the app relies on to have their community-generated profile removed.
//
// WHAT THIS CHECKS. Every route file under app/api that (a) calls an admin or moderator gate and
// (b) exports a mutating handler (POST/PUT/PATCH/DELETE) must reach a durable audit write: an
// `insert*Audit(...)` helper or a raw `INSERT INTO ..._audit...`, either in the route itself or in a
// `lib/` module the route imports directly.
//
// KNOWN LIMIT, stated so a pass is not mistaken for proof. This follows one import hop, so a route →
// lib → deeper-lib chain that only writes at the third level reads as uncovered; that direction is
// safe (it over-reports, and the fix is to say so in the allowlist with the file that does the
// write). It also cannot tell a correct audit row from a wrong one — only that one is written.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const WEB_ROOT = join(REPO_ROOT, 'ctf', 'packages', 'web');
const API_ROOT = join(WEB_ROOT, 'app', 'api');
const ALLOWLIST_PATH = join(import.meta.dirname, 'admin-audit-coverage-allowlist.json');

const ADMIN_GATE = /\brequire[A-Za-z]*(?:Admin|Moderator)[A-Za-z]*\s*\(/;
const MUTATING_HANDLER = /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/;
const DURABLE_WRITE = /\b(?:insert|record|append|write)[A-Za-z]*Audit[A-Za-z]*\s*\(|INSERT\s+INTO\s+[a-z_]*audit[a-z_]*/i;

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

// Every module this file imports that could hold the write: a `lib/...` path (resolved against the
// web package root, which is how the tsconfig paths are set up) or a relative sibling.
function importedModules(file, text) {
  const out = [];
  for (const match of text.matchAll(/from\s+'([^']+)'/g)) {
    const spec = match[1];
    let base;
    if (spec.startsWith('lib/')) base = join(WEB_ROOT, spec);
    else if (spec.startsWith('.')) base = join(dirname(file), spec);
    else continue;
    for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
      try {
        if (statSync(candidate).isFile()) out.push(candidate);
      } catch {
        // no-trace: a specifier that resolves to nothing on disk (a type-only path, a package) is
        // simply not a place the write could live.
      }
    }
  }
  return out;
}

let allowlist = { routes: [] };
try {
  allowlist = JSON.parse(read(ALLOWLIST_PATH));
} catch {
  // no-trace: a missing allowlist is treated as empty rather than fatal, so the gate still runs.
}
const allowed = new Map((allowlist.routes ?? []).map((entry) => [entry.route, entry.reason]));

const routeFiles = walk(API_ROOT).filter((f) => /\/route\.ts$/.test(f));
const moduleCache = new Map();
function moduleHasWrite(file) {
  if (!moduleCache.has(file)) moduleCache.set(file, DURABLE_WRITE.test(read(file)));
  return moduleCache.get(file);
}

const uncovered = [];
const usedAllowlistEntries = new Set();
let adminMutatingCount = 0;

for (const file of routeFiles) {
  const text = read(file);
  if (!ADMIN_GATE.test(text) || !MUTATING_HANDLER.test(text)) continue;
  adminMutatingCount += 1;

  const routePath = `/${relative(join(WEB_ROOT, 'app'), file).replace(/\\/g, '/').replace(/\/route\.ts$/, '')}`;
  if (allowed.has(routePath)) {
    usedAllowlistEntries.add(routePath);
    continue;
  }

  const covered = DURABLE_WRITE.test(text) || importedModules(file, text).some(moduleHasWrite);
  if (!covered) uncovered.push({ routePath, file: relative(REPO_ROOT, file) });
}

const staleAllowlist = [...allowed.keys()].filter((route) => !usedAllowlistEntries.has(route));

console.log(`check-admin-audit-coverage: ${adminMutatingCount} admin route(s) that change data; ${allowed.size} on the burn-down list.`);

if (staleAllowlist.length > 0) {
  // Not a failure: an entry whose route is gone or now covered just means the entry can go. Reported
  // so the list shrinks instead of accumulating entries nobody dares remove.
  console.log('\nBurn-down entries that are no longer needed (route gone, or it writes an audit row now — delete these):');
  for (const route of staleAllowlist) console.log(`  • ${route}`);
}

if (uncovered.length === 0) {
  console.log('\n✅ Every admin route that changes data writes a durable audit row (or has a recorded reason not to).');
  process.exit(0);
}

console.error(`\n❌ ${uncovered.length} admin route(s) change data and write no durable audit row:\n`);
for (const entry of uncovered) {
  console.error(`  • ${entry.routePath}`);
  console.error(`      ${entry.file}`);
}
console.error(`
Every admin action is recorded, on every surface, from the day the surface ships. That record is what
lets the owner check their own admins — including themselves — and it is the reason an admin surface
can offer every action on every row instead of withholding some to prevent misuse.

A console line is not a record. Several surfaces have a lib/<plugin>/audit.ts that builds the whole
contract-shaped event and ends in console.info: nothing can query it, no screen can show it, and it
ages out of the host's log retention. Route it to a table instead.

Fix it one of two ways:
  1. Write the row — call the plugin's insert*Audit helper (see lib/skills-hunt/repository.ts
     insertSkillsHuntAudit for the shape) after the mutation succeeds.
  2. Give the plugin an audit table if it has none, then do (1).

Add an entry to ctf/scripts/admin-audit-coverage-allowlist.json only for a route where a durable row
is genuinely written somewhere this gate cannot see, and name the file that writes it. Do not add an
entry to silence the gate.
`);
process.exit(1);
