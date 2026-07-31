#!/usr/bin/env node
// Fails when a British spelling appears anywhere in this repository.
//
// Why this exists: a recurring Commons notice shipped to production using the British form of
// "realize". It was introduced while paraphrasing the owner's sentence, which used the US form.
// Nothing in the pipeline knew the difference — typecheck, lint, and the notice gates all pass on a
// correctly-spelled word from the wrong dialect. The product's copy is US English, so a British
// spelling is a defect, and the only reliable way to keep it out is to check for it.
//
// The check is deliberately not limited to member-facing strings. Comments and identifiers set the
// example the next writer copies, so the whole tree is held to one dialect.
//
// The word list lives in ./lib/us-spelling.mjs, shared with changed-files.mjs — see the comment
// there for why the two have to read the same list, and for how to add a rule.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RULES, PATTERNS } from './lib/us-spelling.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

// Files exempt from the check, each for a stated reason. This list should stay tiny.
const EXEMPT_FILES = new Set([
  // A verbatim archive of what real people actually posted on Quora. Correcting someone's spelling
  // inside a captured record would falsify the record, so it is kept exactly as captured.
  'ctf/scripts/data/comic-knowledge-seed-2.jsonl',
  // The word list, which necessarily spells out every British word this gate looks for.
  'ctf/scripts/lib/us-spelling.mjs',
  // The banned-pleasantries dictionary and its hook list British forms on purpose, so that a reply
  // using one is caught. They have to name the word to detect it.
  'CLAUDE.md',
  '.claude/hooks/check-no-pleasantries.mjs',
  // Generated dependency graph. The names in it belong to third-party packages — one real npm
  // package under the @img scope is named with the British spelling of "color" — and a dependency's
  // name is not ours to respell.
  'pnpm-lock.yaml',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'artifacts',
  '.git',
  // Submodules: each is its own repository with its own history, and several are deprecated
  // reference-only. This check governs this repository.
  'design',
  'landing-page',
  'waitlist-landing-page',
  'wiki',
  'wiki-site',
  'ctf-v2-deprecated',
]);

const CHECK_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.md',
  '.mdc',
  '.sql',
  '.yaml',
  '.yml',
  '.json',
  '.txt',
  '.sh',
]);


// Committed files only. Asking git rather than walking the disk keeps local scratch directories,
// build output, and broken symlinks out of the check, and means the gate looks at exactly what a
// reader of the repository would see.
function trackedFiles() {
  const listing = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return listing
    .split('\0')
    .filter(Boolean)
    .filter((path) => !path.split('/').some((segment) => SKIP_DIRS.has(segment)));
}

function hasCheckedExtension(path) {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return false;
  return CHECK_EXTENSIONS.has(path.slice(dot));
}

const findings = [];

for (const repoPath of trackedFiles()) {
  if (!hasCheckedExtension(repoPath)) continue;
  if (EXEMPT_FILES.has(repoPath)) continue;

  let contents;
  try {
    contents = readFileSync(join(REPO_ROOT, repoPath), 'utf8');
  } catch {
    continue;
  }

  const lines = contents.split('\n');
  for (const [index, line] of lines.entries()) {
    for (const { rule, pattern } of PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (!match) continue;
      findings.push({
        file: repoPath,
        line: index + 1,
        found: match[0],
        expected: rule.us,
        text: line.trim().slice(0, 140),
      });
    }
  }
}

if (findings.length === 0) {
  console.log(`check-us-spelling: no British spellings found (${RULES.length} rules).`);
  process.exit(0);
}

console.error(
  `check-us-spelling: found ${findings.length} British spelling(s). The product writes US English.\n`,
);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}  "${finding.found}" -> "${finding.expected}"`);
  console.error(`    ${finding.text}`);
}
console.error(
  '\nFix each one. If a hit is a genuine exception (a quoted record, a third-party name),',
);
console.error('add the file to EXEMPT_FILES in ctf/scripts/check-us-spelling.mjs with a reason.');
process.exit(1);
