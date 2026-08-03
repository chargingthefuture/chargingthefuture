#!/usr/bin/env node
// Enforce rule 137 (verbose error handling): when a route fails, its answer must say what failed and
// why, and the caught error must never be discarded.
//
// Three failures are reported, all inside `catch` blocks that answer with an error response:
//
//   unbound      `catch {` with no binding — the reason was thrown away before anything could use it.
//   unreported   a 5xx answer whose catch never passes the caught error to reportError/failureResponse.
//                (A 4xx from bad caller input does not have to be reported — it is not an incident.)
//   no-reason    an operator route (admin / internal / cron) whose error message carries no reason.
//
// ctf/config/error-verbosity-allowlist.json holds a per-file budget for what existed when this gate
// landed. A budget may shrink, never grow; a file not listed must be clean. Regenerate the file's
// counts only downwards — never add an entry to silence the gate.
//
//   Run:    pnpm --dir ctf run check:error-verbosity
//   Update: pnpm --dir ctf run check:error-verbosity -- --write-allowlist   (only ever lowers budgets)

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const routesRoot = join(repoRoot, 'ctf/packages/web/app/api');
const allowlistPath = join(repoRoot, 'ctf/config/error-verbosity-allowlist.json');

const WRITE = process.argv.includes('--write-allowlist');

function routeFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...routeFiles(full));
    } else if (entry === 'route.ts') {
      found.push(full);
    }
  }
  return found.sort();
}

// Every `catch` in the file with its binding, body, and start line. Brace-matched rather than parsed:
// the shapes here are ordinary handler code, and a full parser would be a heavier dependency than the
// check is worth.
function catchBlocks(source) {
  const blocks = [];
  const re = /catch\s*(\(([^)]*)\))?\s*\{/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const binding = (match[2] ?? '').trim().split(':')[0].trim();
    let depth = 1;
    let i = re.lastIndex;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    blocks.push({
      binding,
      body: source.slice(re.lastIndex, i - 1),
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return blocks;
}

const ANSWERS = /(NextResponse|Response)\s*\.\s*json\s*\(|new\s+Response\s*\(|failureResponse\s*\(/;

// The status a catch answers with. Reads every `status:` in the block and takes the highest, so a block
// that can answer 400 or 503 is judged on the 503.
function answeredStatus(body) {
  const found = [...body.matchAll(/status\s*:\s*(\d{3})/g)].map((m) => Number.parseInt(m[1], 10));
  if (found.length > 0) {
    return Math.max(...found);
  }
  // failureResponse defaults to 503 when no status is passed.
  return /failureResponse\s*\(/.test(body) ? 503 : 0;
}

function findings(file, source) {
  const rel = relative(repoRoot, file).split('\\').join('/');
  const operatorSurface = /\/(admin|internal|cron)\//.test(rel);
  const out = [];

  for (const block of catchBlocks(source)) {
    if (!ANSWERS.test(block.body)) {
      continue; // a non-answering catch is a side path; rule 137 point 1 is reviewed, not gated here
    }
    const usesHelper = /failureResponse\s*\(/.test(block.body);

    if (block.binding.length === 0) {
      out.push({ rel, line: block.line, kind: 'unbound', detail: 'catch has no binding, so the reason is discarded' });
      continue;
    }

    const bound = new RegExp(`\\b${block.binding}\\b`);
    const status = answeredStatus(block.body);
    const reported = usesHelper
      || new RegExp(`reportError\\s*\\(\\s*${block.binding}\\b`).test(block.body);
    if (status >= 500 && !reported) {
      out.push({ rel, line: block.line, kind: 'unreported', detail: `answers ${status} without reporting the error` });
    }

    if (operatorSurface && !usesHelper) {
      // Does the reason reach the answer? Either the bound error appears inside a response call, or the
      // block builds the message with one of the shared helpers.
      const responseAt = block.body.search(ANSWERS);
      const answer = block.body.slice(responseAt);
      const carriesReason = bound.test(answer) || /\b(withReason|failureReason)\s*\(/.test(block.body);
      if (!carriesReason) {
        out.push({ rel, line: block.line, kind: 'no-reason', detail: 'operator-surface message carries no reason' });
      }
    }
  }

  return out;
}

function main() {
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const budgets = allowlist.files ?? {};

  const counts = new Map();
  const all = [];
  for (const file of routeFiles(routesRoot)) {
    const results = findings(file, readFileSync(file, 'utf8'));
    if (results.length === 0) continue;
    counts.set(results[0].rel, results.length);
    all.push(...results);
  }

  if (WRITE) {
    const next = {};
    for (const [rel, count] of [...counts.entries()].sort()) {
      const existing = budgets[rel];
      next[rel] = typeof existing === 'number' ? Math.min(existing, count) : count;
    }
    // A file that is clean now loses its budget for good.
    writeFileSync(allowlistPath, `${JSON.stringify({ ...allowlist, files: next }, null, 2)}\n`);
    console.log(`check-error-verbosity: wrote ${Object.keys(next).length} budgets (total ${all.length}).`);
    return;
  }

  const over = [];
  for (const [rel, count] of [...counts.entries()].sort()) {
    const budget = budgets[rel] ?? 0;
    if (count > budget) {
      over.push({ rel, count, budget });
    }
  }

  const listed = Object.keys(budgets).length;
  const budgeted = Object.values(budgets).reduce((sum, n) => sum + n, 0);
  console.log(`check-error-verbosity: ${all.length} finding(s) across ${counts.size} route file(s).`);
  console.log(`  burn-down list: ${listed} file(s), ${budgeted} allowed. Rule: .claude/rules/137-verbose-error-handling-rules.mdc`);

  if (over.length === 0) {
    console.log('✅ No new opaque error paths.');
    return;
  }

  console.error('\n❌ New or increased opaque error paths:\n');
  for (const item of over) {
    console.error(`  ${item.rel} — ${item.count} finding(s), ${item.budget} allowed`);
    for (const finding of all.filter((f) => f.rel === item.rel)) {
      console.error(`      line ${finding.line}: ${finding.kind} — ${finding.detail}`);
    }
  }
  console.error('\nFix: answer with failureResponse({ summary, error, code, area, op }) from');
  console.error("lib/errors/failure.ts, or include withReason('…', error) in the message. Do not add an");
  console.error('allowlist entry — the burn-down list only shrinks.');
  process.exit(1);
}

main();
