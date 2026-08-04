#!/usr/bin/env node
// Orphan API route gate.
//
// WHY THIS EXISTS. The inventory-drift gate asks one question — is every route and table *documented*?
// It is blind to the opposite failure: code that exists, is documented, and does nothing. Two real bugs
// found by hand on 2026-07-29/30 were exactly that shape, and both passed every gate:
//
//   - `GET /api/feed/admin/questions` aggregates a `flagged_count` so an admin can review flagged
//     answers. No page has ever called it, so a member flagging an answer reached nobody.
//   - `moderation_status` on the Commons tables looked like the mechanism for hiding a post, but no
//     query read it, so setting it did nothing. (A column, not a route — this gate does not catch that
//     case. See the note at the bottom.)
//
// Documented-but-dead is worse than undocumented, because the docs actively assert a capability the
// product does not have. This gate fails when a route under app/api has no caller anywhere in the
// repo and is not on the allowlist.
//
// HOW IT MATCHES. A route's static prefix is everything up to its first dynamic ([param]) segment.
// A reference counts when that prefix appears in a source file AND the character after it is
// consistent with this route rather than a longer sibling path:
//   - a route with no dynamic segments needs the path to END there (quote, backtick, ?, #, or space)
//   - a route with dynamic segments needs a `/` after the prefix
//
// KNOWN LIMIT, stated so nobody mistakes a pass for proof. When a static route and a dynamic sibling
// share a prefix (`/api/x/export` next to `/api/x/[id]`), a call to one satisfies the other. That is a
// false negative — this gate under-reports rather than blocking CI on a guess. It also cannot see
// unread database columns, which is the other half of the same failure mode.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const API_ROOT = join(REPO_ROOT, 'ctf', 'packages', 'web', 'app', 'api');
const ALLOWLIST_PATH = join(import.meta.dirname, 'orphan-route-allowlist.json');

// Where a caller could plausibly live. The route files themselves are excluded — a route referencing
// its own path in a comment must not count as a caller.
const SEARCH_ROOTS = [
  join(REPO_ROOT, 'ctf', 'packages', 'web'),
  join(REPO_ROOT, 'ctf', 'packages', 'mobile'),
  join(REPO_ROOT, 'ctf', 'packages', 'shared'),
  join(REPO_ROOT, 'ctf', 'scripts'),
  join(REPO_ROOT, '.github'),
];

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.expo', 'android', 'ios']);
const SEARCHABLE = /\.(ts|tsx|js|jsx|mjs|cjs|yml|yaml|md|json)$/;

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

// Turn app/api/feed/admin/moderation/[target]/[id]/route.ts into /api/feed/admin/moderation/[target]/[id].
function routePathFor(file) {
  const rel = relative(join(REPO_ROOT, 'ctf', 'packages', 'web', 'app'), file).replace(/\\/g, '/');
  const withoutFile = rel.replace(/\/route\.(ts|tsx|js)$/, '');
  // Next.js route groups — (marketing) — are organizational and carry no URL segment.
  const segments = withoutFile.split('/').filter((s) => !(s.startsWith('(') && s.endsWith(')')));
  return `/${segments.join('/')}`;
}

function staticPrefixOf(routePath) {
  const segments = routePath.split('/');
  const out = [];
  for (const segment of segments) {
    if (segment.startsWith('[')) break;
    out.push(segment);
  }
  return out.join('/') || '/';
}

const routeFiles = walk(API_ROOT).filter((f) => /\/route\.(ts|tsx|js)$/.test(f));
const routeFileSet = new Set(routeFiles);

const searchFiles = [];
for (const root of SEARCH_ROOTS) {
  for (const file of walk(root)) {
    if (!SEARCHABLE.test(file)) continue;
    if (routeFileSet.has(file)) continue;
    searchFiles.push(file);
  }
}

// One pass over every searchable file, so this stays linear rather than re-reading the tree per route.
const haystack = searchFiles.map((file) => {
  try {
    return { file, text: readFileSync(file, 'utf8') };
  } catch {
    return { file, text: '' };
  }
});

let allowlist = { routes: [] };
try {
  allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
} catch {
  // no-trace: a missing allowlist is treated as empty rather than fatal, so the gate still runs.
}
const allowed = new Map((allowlist.routes ?? []).map((entry) => [entry.route, entry.reason]));

// True when `text` references this exact route rather than a longer path that merely starts the same.
function referencesRoute(text, prefix, hasDynamic) {
  let from = 0;
  for (;;) {
    const at = text.indexOf(prefix, from);
    if (at === -1) return false;
    const after = text[at + prefix.length] ?? '';
    if (hasDynamic) {
      if (after === '/') return true;
    } else if (after === '' || !/[A-Za-z0-9/_-]/.test(after)) {
      // End of the path: a quote, backtick, ?, #, whitespace, ) and so on all mean the path stops here.
      return true;
    }
    from = at + 1;
  }
}

const orphans = [];
const usedAllowlistEntries = new Set();

for (const file of routeFiles) {
  const routePath = routePathFor(file);
  const prefix = staticPrefixOf(routePath);
  const hasDynamic = routePath.includes('[');

  if (allowed.has(routePath)) {
    usedAllowlistEntries.add(routePath);
    continue;
  }

  const called = haystack.some(({ text }) => referencesRoute(text, prefix, hasDynamic));
  if (!called) {
    orphans.push({ routePath, file: relative(REPO_ROOT, file) });
  }
}

const staleAllowlist = [...allowed.keys()].filter((route) => !usedAllowlistEntries.has(route));

console.log(`check-orphan-routes: scanned ${routeFiles.length} API routes against ${haystack.length} source files.`);

if (staleAllowlist.length > 0) {
  // Not a failure: an allowlisted route that no longer exists just means the entry can go. Reported so
  // the allowlist shrinks over time instead of accumulating dead entries nobody dares remove.
  console.log('\nAllowlist entries for routes that no longer exist (safe to delete):');
  for (const route of staleAllowlist) console.log(`  • ${route}`);
}

if (orphans.length === 0) {
  console.log('\n✅ No orphan routes: every API route has a caller in the repo (or a documented reason not to).');
  process.exit(0);
}

console.error(`\n❌ ${orphans.length} API route(s) exist but nothing calls them:\n`);
for (const orphan of orphans) {
  console.error(`  • ${orphan.routePath}`);
  console.error(`      ${orphan.file}`);
}
console.error(`
A route with no caller is dead code that the feature inventory still advertises as a capability. That
is how a member's flag on an answer reached nobody for weeks: the route existed, it was documented, and
no page ever called it.

Fix it one of two ways:
  1. Wire it up — if the capability is supposed to exist, give it a caller.
  2. Delete it — if it is not needed, remove the route and its inventory entry.

If it is genuinely called from outside this repository (a provider webhook, an uptime check, an embed on
another site), add it to ctf/scripts/orphan-route-allowlist.json with a reason that says WHO calls it.
Do not add an entry just to silence this gate.
`);
process.exit(1);
