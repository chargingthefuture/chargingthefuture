#!/usr/bin/env node
/**
 * A parameterized query must number its placeholders $1..$N with no gaps.
 *
 * Postgres infers each parameter's type from where it is used, so a parameter that is supplied and
 * never referenced has no type to infer and the statement is refused before it runs: "could not
 * determine data type of parameter $3". Types check, lint passes, the build succeeds, and the first
 * person to find it is an admin opening a screen that now shows only a red line.
 *
 * It ships that way whenever a predicate is removed from a query and the placeholders after it are
 * not renumbered. Directory's admin list broke on 2026-09-21 when the tombstone-column drop removed
 * `$1 includeDeleted` and renumbered the shared WHERE from $2/$3 down to $1/$2, but left the page
 * query's own tail reading `OFFSET $4 LIMIT $5`. Foundation's quote transition had the same shape:
 * six values supplied, $3 and $4 referenced nowhere. Both were found by hand, days apart.
 *
 * What this checks: the placeholders inside one statement run from $1 with nothing missing. It reads
 * the SQL alone and never needs to know how many values the call passes, so a spread argument
 * (`[...predicateParams, offset, pageSize]`) is judged exactly as well as a literal list.
 *
 * What it cannot check: whether each value sits opposite the placeholder meant for it, or whether
 * the count of values matches N. Those need the call site resolved; the gap is the one that takes a
 * screen down and it is visible in the text.
 *
 * Only a template literal passed as the query text to `.query(...)` or `queryDb(...)` is read. A
 * fragment held in its own variable and interpolated later carries no numbering of its own, so it is
 * judged as part of the statement that uses it, never alone. A statement interpolating a fragment
 * this script cannot resolve to a module-level constant is skipped rather than guessed at.
 *
 * Run: node ctf/scripts/check-sql-placeholder-gaps.mjs
 */

import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ctfRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(ctfRoot, '..');
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage']);

/** Every TypeScript/JavaScript source under ctf/, build output and dependencies aside. */
function sourceFiles(dir, found = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) found.push(full);
  }
  return found;
}

/** Module-level ``const NAME = `…` `` SQL fragments, so an interpolated predicate can be resolved. */
function moduleConstants(source) {
  const constants = new Map();
  for (const match of source.matchAll(/^const (\w+) = `([\s\S]*?)`;$/gm)) {
    constants.set(match[1], match[2]);
  }
  return constants;
}

/**
 * The template literals this file passes as query text: the backtick string immediately after
 * `.query(`, `.query<Row>(` or `queryDb(`, optional whitespace between. Anything else that happens
 * to hold SQL is a fragment and is read only where it is interpolated.
 */
function queryTemplates(source) {
  const found = [];
  const opener = /(?:\.query|queryDb|queryDbWrite)\s*(?:<[^>]*>)?\s*\(\s*`/g;
  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    const start = match.index + match[0].length;
    const end = source.indexOf('`', start);
    if (end === -1) continue;
    found.push({ sql: source.slice(start, end), index: start });
  }
  return found;
}

/** The statement with its interpolated constants filled in, or null when one cannot be resolved. */
function resolve(sql, constants) {
  let resolved = sql;
  let unresolved = false;
  resolved = resolved.replace(/\$\{(\w+)\}/g, (_whole, name) => {
    const value = constants.get(name);
    if (value === undefined) {
      unresolved = true;
      return '';
    }
    return value;
  });
  return unresolved || resolved.includes('${') ? null : resolved;
}

/** The placeholder numbers missing from $1..$max, or an empty list when the run is unbroken. */
function gaps(sql) {
  const used = new Set([...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])));
  if (used.size === 0) return [];
  const highest = Math.max(...used);
  const missing = [];
  for (let n = 1; n <= highest; n += 1) {
    if (!used.has(n)) missing.push(n);
  }
  return missing;
}

const failures = [];
for (const file of sourceFiles(ctfRoot)) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('$1')) continue;
  const constants = moduleConstants(source);
  for (const { sql, index } of queryTemplates(source)) {
    const resolved = resolve(sql, constants);
    if (resolved === null) continue;
    const missing = gaps(resolved);
    if (missing.length === 0) continue;
    const used = [...new Set([...resolved.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    failures.push({
      file: relative(repoRoot, file),
      line: source.slice(0, index).split('\n').length,
      used,
      missing,
    });
  }
}

if (failures.length === 0) {
  console.log('check-sql-placeholder-gaps: no gaps — every query numbers its placeholders from $1 with none missing.');
  process.exit(0);
}

console.error(`check-sql-placeholder-gaps: found ${failures.length} quer${failures.length === 1 ? 'y' : 'ies'} with a gap in their placeholder numbering.\n`);
for (const failure of failures) {
  console.error(`  ${failure.file}:${failure.line}`);
  console.error(`    uses $${failure.used.join(', $')} — nothing references $${failure.missing.join(', $')}`);
}
console.error(`
Postgres refuses a statement whose parameter is never referenced, because there is nothing to infer
its type from, and says "could not determine data type of parameter $N". Renumber the placeholders
so they run from $1 with none missing, and drop any value the statement no longer uses.
`);
process.exit(1);
