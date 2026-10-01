#!/usr/bin/env node
// Fails when "whole" or "stale" appears in this repository's own text.
//
// Why this exists: both words are on the banned-term list in CLAUDE.md (owner directives,
// 2026-08-28 through 2026-09-19). The Stop hook in .claude/hooks/ keeps them out of agent replies,
// but nothing kept them out of what agents commit — comments, docs, workflow notes and member-facing
// copy — and that text is what the next writer copies. So the check runs over every tracked file.
//
// What it skips, each for a stated reason, lives in ctf/config/banned-words-allowlist.json:
//   - paths: files or folders (a trailing slash means a folder) that define the ban or are not ours.
//   - filePatterns: licence files and lockfiles, matched by regular expression.
//   - phrases: fixed names that contain a banned word and cannot be reworded (an HTTP header
//     directive, a GitHub setting, a company name). Matched case-insensitively.
// Any word inside a URL (an http:// or https:// token) is also skipped: an address is not prose.
//
// For a verbatim quote of somebody else's words, mark the line with `banned-words:allow`, or wrap a
// block in `banned-words:disable` ... `banned-words:enable`. A file that disables and never
// re-enables is itself a finding, so a region cannot quietly swallow the rest of a file.
//
// Identifiers count too. If a name in code carries a banned word, rename it or say why it cannot be
// renamed on an allow marker.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CONFIG_PATH = join(REPO_ROOT, 'ctf/config/banned-words-allowlist.json');

const BANNED = /\b(whole|stale)\b/i;
const URL_TOKEN = /https?:\/\/\S+/gi;

function loadConfig() {
  let raw;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf8');
  } catch (error) {
    console.error(`check-banned-words: could not read ${CONFIG_PATH}: ${error.message}`);
    process.exit(2);
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    console.error(`check-banned-words: ${CONFIG_PATH} is not valid JSON: ${error.message}`);
    process.exit(2);
  }
  const problems = [];
  for (const [key, field] of [
    ['paths', 'path'],
    ['filePatterns', 'regex'],
    ['phrases', 'text'],
  ]) {
    if (!Array.isArray(config[key])) {
      problems.push(`"${key}" must be an array`);
      continue;
    }
    for (const [index, entry] of config[key].entries()) {
      if (typeof entry?.[field] !== 'string' || entry[field] === '') {
        problems.push(`${key}[${index}] needs a non-empty "${field}"`);
      }
      if (typeof entry?.reason !== 'string' || entry.reason.trim() === '') {
        problems.push(`${key}[${index}] needs a "reason" saying why it is exempt`);
      }
    }
  }
  if (problems.length > 0) {
    console.error(`check-banned-words: ${CONFIG_PATH} is malformed:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(2);
  }
  return {
    paths: config.paths.map((entry) => entry.path),
    filePatterns: config.filePatterns.map((entry) => new RegExp(entry.regex)),
    phrases: config.phrases.map(
      (entry) => new RegExp(entry.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
    ),
  };
}

const config = loadConfig();

function isExemptPath(repoPath) {
  for (const exempt of config.paths) {
    if (exempt.endsWith('/') ? repoPath.startsWith(exempt) : repoPath === exempt) return true;
  }
  return config.filePatterns.some((pattern) => pattern.test(repoPath));
}

// Committed files only, so local scratch files and build output stay out of the check.
function trackedFiles() {
  const listing = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return listing.split('\0').filter(Boolean);
}

// A NUL byte in the first 8 KB is the same test git uses to call a file binary.
function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

function stripExempt(line) {
  let text = line.replace(URL_TOKEN, ' ');
  for (const phrase of config.phrases) text = text.replace(phrase, ' ');
  return text;
}

const findings = [];
let scanned = 0;

for (const repoPath of trackedFiles()) {
  if (isExemptPath(repoPath)) continue;
  const fullPath = join(REPO_ROOT, repoPath);

  // Submodules show up in `git ls-files` as directories; they are other repositories.
  let stats;
  try {
    stats = statSync(fullPath);
  } catch {
    continue;
  }
  if (!stats.isFile()) continue;

  const buffer = readFileSync(fullPath);
  if (isBinary(buffer)) continue;
  scanned += 1;

  let disabled = false;
  let disabledAtLine = 0;
  const lines = buffer.toString('utf8').split('\n');
  for (const [index, line] of lines.entries()) {
    if (line.includes('banned-words:disable')) {
      disabled = true;
      disabledAtLine = index + 1;
      continue;
    }
    if (line.includes('banned-words:enable')) {
      disabled = false;
      continue;
    }
    if (disabled || line.includes('banned-words:allow')) continue;
    const match = BANNED.exec(stripExempt(line));
    if (!match) continue;
    findings.push({
      file: repoPath,
      line: index + 1,
      found: match[0],
      text: line.trim().slice(0, 140),
    });
  }
  if (disabled) {
    findings.push({
      file: repoPath,
      line: disabledAtLine,
      found: 'banned-words:disable',
      text: 'region never re-enabled, so the rest of the file is unchecked',
    });
  }
}

if (findings.length === 0) {
  console.log(`check-banned-words: no banned words found in ${scanned} files.`);
  process.exit(0);
}

console.error(`check-banned-words: found ${findings.length} banned word(s).\n`);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}  "${finding.found}"`);
  console.error(`    ${finding.text}`);
}
console.error(
  '\nRewrite each sentence: drop the word, or use entire / all of / end to end, or name what',
);
console.error(
  'is meant (out of date, expired, older than N minutes). For a verbatim quote, mark the line',
);
console.error(
  'with banned-words:allow. For a fixed name, add it to ctf/config/banned-words-allowlist.json.',
);
process.exit(1);
