#!/usr/bin/env node
// Dependency audit gate: fails when any package in the locked production dependency tree carries a
// publicly reported security advisory that is not already on the burn-down list.
//
// Why this exists (owner decision, 2026-08-03): the PR-diff dependency review only inspects newly
// added dependencies, so an advisory published against a package we already ship arrived silently —
// nothing watched the locked tree. This gate runs `pnpm audit --prod` on a schedule and on lockfile
// changes, so a new advisory turns a workflow red within a day of being published.
//
// The allowlist `dependency-audit-allowlist.json` is a BURN-DOWN list, like the deletion-coverage
// one: it was seeded with the advisories open on the day the gate was added (transitive packages
// pinned by their parents, waiting on upstream releases) and may only ever shrink. The gate fails
// BOTH ways: a new advisory not on the list fails the run, and a listed advisory that no longer
// applies fails the run until it is removed — so the list always states exactly what is still open.
// Never add a new advisory to the list to silence the gate; update the dependency instead, and use
// the list only when the fix is genuinely out of our hands (documented in the entry's note).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const CTF_ROOT = fileURLToPath(new URL('..', import.meta.url));
const ALLOWLIST_PATH = join(CTF_ROOT, 'scripts', 'dependency-audit-allowlist.json');

function runAudit() {
  // pnpm audit exits non-zero when advisories exist; the JSON on stdout is still complete.
  try {
    const out = execFileSync('pnpm', ['audit', '--prod', '--json'], {
      cwd: CTF_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (error) {
    if (error && typeof error.stdout === 'string' && error.stdout.trim().startsWith('{')) {
      return JSON.parse(error.stdout);
    }
    console.error('check-dependency-audit: pnpm audit did not produce JSON output.');
    console.error(error?.message ?? error);
    process.exit(2);
  }
}

const report = runAudit();
const advisories = report.advisories ?? {};
const open = new Map(
  Object.entries(advisories).map(([id, a]) => [
    String(id),
    { module: a.module_name, severity: a.severity, title: a.title },
  ]),
);

const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
const allowed = new Map(Object.entries(allowlist.advisories ?? {}));

const fresh = [...open.entries()].filter(([id]) => !allowed.has(id));
const resolved = [...allowed.keys()].filter((id) => !open.has(id));

if (fresh.length > 0) {
  console.error(`check-dependency-audit: ${fresh.length} NEW advisory(ies) not on the burn-down list:`);
  for (const [id, a] of fresh) {
    console.error(`  ${id} [${a.severity}] ${a.module} — ${a.title}`);
  }
  console.error('\nFix: update the affected package so the advisory clears (preferred). Only if the');
  console.error('fix is genuinely out of our hands (a transitive pin waiting on an upstream release)');
  console.error(`may the advisory be added to ${ALLOWLIST_PATH} with a note saying what it waits on.`);
}

if (resolved.length > 0) {
  console.error(`check-dependency-audit: ${resolved.length} allowlisted advisory(ies) no longer apply — remove them so the list only ever shrinks:`);
  for (const id of resolved) {
    const entry = allowed.get(id);
    console.error(`  ${id} [${entry.severity}] ${entry.module}`);
  }
}

if (fresh.length > 0 || resolved.length > 0) {
  process.exit(1);
}

console.log(`check-dependency-audit: no new advisories (${open.size} known transitive advisory(ies) on the burn-down list).`);
