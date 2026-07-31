#!/usr/bin/env node
// Prints the files a branch changed against its base, with dialect-only changes removed.
//
// Why: three gates in this repository ask a behavior question about the set of changed files —
// Modularity and Complexity Governance, the Test Script Drift Gate, and the Stream Quota Impact
// Note. A repo-wide spelling sweep touches a hundred files without changing behavior anywhere, and
// every one of those gates fired on it: a comment-only edit dragged six pre-existing complexity
// violations into scope, eleven inventories looked like they had drifted from their test scripts,
// and a comment in a Stream file demanded a quota note for a change that consumes nothing.
//
// The fix is not to weaken any of those gates. It is to answer their question honestly. A file
// whose entire diff disappears when both sides are rewritten to US English did not change behavior,
// and this script drops exactly those files and no others. Anything else in the same commit — a
// real edit to the same file, even one line — keeps the file in the list.
//
//   Usage:  node ctf/scripts/changed-files.mjs [--base <ref>] [--relative-to <dir>]
//   Output: one repository-relative path per line (or relative to --relative-to).
//
// The base defaults to the PR's target branch when GITHUB_BASE_REF is set, then origin/main. With
// no resolvable base it prints nothing and exits 0, which is the safe answer locally.

import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { differsOnlyInDialect } from './lib/us-spelling.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}


function tryGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function resolveBase() {
  const explicit = arg('--base');
  if (explicit) return tryGit(['rev-parse', '--verify', explicit]) ? explicit : null;
  if (process.env.GITHUB_BASE_REF) {
    const ref = `origin/${process.env.GITHUB_BASE_REF}`;
    if (tryGit(['rev-parse', '--verify', ref])) return ref;
  }
  if (tryGit(['rev-parse', '--verify', 'origin/main'])) return 'origin/main';
  return null;
}

const base = resolveBase();
if (!base) process.exit(0);

const mergeBase = (tryGit(['merge-base', base, 'HEAD']) || base).trim();

const changed = (tryGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', `${mergeBase}...HEAD`]) || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

// A file is dialect-only when its base and head contents match after both are rewritten to US
// English. Added files have no base version, so they are always real changes.
function isDialectOnly(path) {
  const before = tryGit(['show', `${mergeBase}:${path}`]);
  if (before === null) return false;
  const after = tryGit(['show', `HEAD:${path}`]);
  if (after === null) return false;
  try {
    return differsOnlyInDialect(before, after);
  } catch {
    return false;
  }
}

const relativeTo = arg('--relative-to');
const out = [];
for (const path of changed) {
  if (isDialectOnly(path)) continue;
  out.push(relativeTo ? relative(resolve(REPO_ROOT, relativeTo), resolve(REPO_ROOT, path)) : path);
}

if (out.length > 0) console.log(out.join('\n'));
