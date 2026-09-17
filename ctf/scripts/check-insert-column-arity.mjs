#!/usr/bin/env node
/**
 * A single-row INSERT that names its columns must supply exactly as many value expressions as
 * columns, and must number its placeholders $1..$N with no gaps.
 *
 * Postgres only reports this when the statement runs, so a mismatch ships green: types check,
 * lint passes, the build succeeds, and the first person to find it is a member pressing Submit.
 * SkillsHunt shipped that way on 2026-09-13 — the nomination INSERT named 18 columns and supplied
 * 19 values, and every nomination in production answered "INSERT has more expressions than target
 * columns". Nothing in CI reads SQL that is written as a string, so nothing caught it.
 *
 * What this cannot check: whether each value is opposite the RIGHT column. That needs the schema's
 * column types and is a separate job. The count is the failure that takes the whole feature down.
 *
 * Only single-row INSERTs with an explicit column list are read. `INSERT ... SELECT`, multi-row
 * VALUES, and an INSERT with no column list are skipped — their shapes carry no arity to compare.
 *
 * Run: node ctf/scripts/check-insert-column-arity.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ctfRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every TypeScript/JavaScript source under ctf/ that mentions an INSERT, node_modules aside. */
function sourceFiles() {
  const out = execFileSync(
    'node',
    [
      '-e',
      `const { readdirSync, statSync } = require('node:fs');
       const { join } = require('node:path');
       const skip = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage']);
       const found = [];
       (function walk(dir) {
         for (const name of readdirSync(dir)) {
           if (skip.has(name)) continue;
           const full = join(dir, name);
           const stat = statSync(full);
           if (stat.isDirectory()) walk(full);
           else if (/\\.(ts|tsx|mjs|js)$/.test(name)) found.push(full);
         }
       })(process.argv[1]);
       process.stdout.write(found.join('\\n'));`,
      ctfRoot,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return out ? out.split('\n') : [];
}

/**
 * The balanced parenthesised group that opens at `open`, or null if it never closes.
 * Quoted text is stepped over so an apostrophe or a bracket inside a string literal does not
 * unbalance the count.
 */
function readGroup(source, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { inner: source.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/** Split a comma-separated list on its top-level commas only. */
function splitTopLevel(list) {
  const items = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of list) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

/** A placeholder run that skips a number means a value was dropped or misnumbered. */
function missingPlaceholders(statement) {
  const used = new Set([...statement.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
  if (used.size === 0) return [];
  const highest = Math.max(...used);
  const gaps = [];
  for (let n = 1; n <= highest; n += 1) {
    if (!used.has(n)) gaps.push(n);
  }
  return gaps;
}

const problems = [];
let inspected = 0;

for (const file of sourceFiles()) {
  const source = readFileSync(file, 'utf8');
  if (!/INSERT\s+INTO/i.test(source)) continue;

  const opener = /INSERT\s+INTO\s+([A-Za-z_][\w."]*)\s*\(/gi;
  let match;
  while ((match = opener.exec(source)) !== null) {
    const columns = readGroup(source, match.index + match[0].length - 1);
    if (!columns) continue;

    // A column list is bare identifiers and nothing else. Anything richer means this parenthesis
    // opened something other than a column list, so there is no arity to compare.
    const columnNames = splitTopLevel(columns.inner.replace(/--[^\n]*/g, ''));
    if (columnNames.length === 0 || !columnNames.every((name) => /^[A-Za-z_]\w*$/.test(name))) continue;

    const after = source.slice(columns.end + 1, columns.end + 400);
    const values = /^\s*VALUES\s*\(/i.exec(after);
    if (!values) continue;

    const valueGroup = readGroup(source, columns.end + 1 + values[0].length - 1);
    if (!valueGroup) continue;

    // A second `(` before the statement ends is a multi-row VALUES list; those are seeds, and the
    // per-row arity is not what this reads.
    const trailing = source.slice(valueGroup.end + 1, valueGroup.end + 40);
    if (/^\s*,\s*\(/.test(trailing)) continue;

    inspected += 1;
    const valueExpressions = splitTopLevel(valueGroup.inner);
    const where = `${relative(ctfRoot, file)}:${source.slice(0, match.index).split('\n').length}`;

    if (valueExpressions.length !== columnNames.length) {
      problems.push(
        `${where} — INSERT INTO ${match[1]} names ${columnNames.length} column(s) `
        + `but supplies ${valueExpressions.length} value(s).`,
      );
      continue;
    }

    const gaps = missingPlaceholders(source.slice(match.index, valueGroup.end + 1));
    if (gaps.length > 0) {
      problems.push(
        `${where} — INSERT INTO ${match[1]} skips placeholder(s) ${gaps.map((n) => `$${n}`).join(', ')}, `
        + 'so the values are misnumbered against the parameter array.',
      );
    }
  }
}

if (problems.length > 0) {
  console.error('INSERT column/value arity check failed:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nCount the column list and the VALUES list, then read them side by side against the '
    + 'parameter array — the mismatch is usually a value added to one list and not the other.',
  );
  process.exit(1);
}

console.log(`INSERT column/value arity check passed (${inspected} single-row INSERTs).`);
