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
// no --base and no resolvable default it prints nothing and exits 0, which is the safe answer
// locally. Every other failure exits 2 with the reason on stderr: an explicit --base that does not
// resolve, or a merge-base or diff that git refuses. Each caller reads empty output as "nothing
// changed" and passes, so printing nothing for a failure would let a gate pass having checked no
// files (a shallow fetch or a renamed base branch in CI).

import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { differsOnlyInDialect } from './lib/us-spelling.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}


function runGit(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// For probes whose failure is an expected answer (does this ref exist, did this file exist at the
// base): null on failure.
function tryGit(args) {
  try {
    return runGit(args);
  } catch {
    // no-trace: a failed probe is the answer ("no such ref", "no such file at the base").
    return null;
  }
}

// For the calls the output depends on: a failure stops the script with git's own reason.
function requireGit(args, what) {
  try {
    return runGit(args);
  } catch (error) {
    const gitSaid = String(error?.stderr || error?.message || error).trim();
    console.error(`changed-files: ${what} failed (git ${args.join(' ')}): ${gitSaid}`);
    process.exit(2);
  }
}

function resolveBase() {
  const explicit = arg('--base');
  if (explicit) {
    // `^{commit}` makes git check the object exists: a bare 40-character hash "verifies" without it.
    if (tryGit(['rev-parse', '--verify', `${explicit}^{commit}`])) return explicit;
    console.error(
      `changed-files: --base '${explicit}' does not resolve to a commit in this checkout, so the changed ` +
        'files cannot be listed. In CI, fetch the base branch with full history (fetch-depth: 0).',
    );
    process.exit(2);
  }
  if (process.env.GITHUB_BASE_REF) {
    const ref = `origin/${process.env.GITHUB_BASE_REF}`;
    if (tryGit(['rev-parse', '--verify', ref])) return ref;
  }
  if (tryGit(['rev-parse', '--verify', 'origin/main'])) return 'origin/main';
  return null;
}

const base = resolveBase();
if (!base) process.exit(0);

const mergeBase = requireGit(['merge-base', base, 'HEAD'], `finding the merge base of ${base} and HEAD`).trim();

const changed = requireGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', `${mergeBase}...HEAD`], 'listing the changed files')
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
