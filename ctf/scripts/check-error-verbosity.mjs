#!/usr/bin/env node
// Enforce rule 137 (verbose error handling): when something fails, the app must say what failed and
// why, and the caught value must never be discarded. Three surfaces, seven failures.
//
// Routes (`ctf/packages/web/app/api/**/route.ts`), inside a catch that answers with an error:
//
//   unbound      `catch {` with no binding — the reason was thrown away before anything could use it.
//   unreported   a 5xx answer whose catch never passes the caught error to reportError/failureResponse.
//                (A 4xx from bad caller input does not have to be reported — it is not an incident.)
//   no-reason    an operator route (admin / internal / cron) whose error message carries no reason.
//
// Screens and hooks (`components/**`, `hooks/**`, `app/**` outside api, and the native app's `src/**`):
//
//   discards-response  a `!res.ok` branch showing a fixed string instead of the route's message.
//   discards-throw     a `catch` showing a fixed string that never uses the caught value.
//
// Everything else that catches (`web/lib/**`, `ctf/scripts/**`, `mobile/src/**`, `shared/src/**`):
//
//   empty-catch   an empty (or comment-only) catch with no `no-trace: <reason>` marker.
//   says-nothing  a catch that does work while neither using nor recording the caught value.
//
// ctf/config/error-verbosity-allowlist.json holds a per-file budget for what existed when this gate
// landed. A budget may shrink, never grow; a file not listed must be clean. Regenerate the file's
// counts only downwards — never add an entry to silence the gate.
//
//   Run:    pnpm --dir ctf run check:error-verbosity
//   Update: pnpm --dir ctf run check:error-verbosity -- --write-allowlist   (only ever lowers budgets)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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

// ---------------------------------------------------------------------------------------------------
// Client surfaces. A route that explains itself is worth nothing if the screen replaces the
// explanation with its own fallback sentence, which is where the reason used to disappear a second
// time. Two failures, both in the screens and hooks that call our own routes:
//
//   discards-response  a `!res.ok` branch that shows a fixed string and never reads the body's
//                      message/reason — the explanation was fetched and thrown away.
//   discards-throw     a `catch` that shows a fixed string and never uses the caught value. The plain
//                      sentence is fine when the request never answered, but the caught value has to
//                      reach reportError so it is not lost.
// ---------------------------------------------------------------------------------------------------

const clientRoots = [
  'ctf/packages/web/components',
  'ctf/packages/web/hooks',
  'ctf/packages/web/app',
  // The native app is the same kind of surface: it calls our routes and shows the result to a person.
  'ctf/packages/mobile/src',
];

function clientFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // `api` is the server half, checked above; node_modules is not ours.
      if (entry !== 'api' && entry !== 'node_modules') found.push(...clientFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && entry !== 'route.ts') {
      found.push(full);
    }
  }
  return found.sort();
}

// Showing the person a failure: a state setter, a toast, an alert, or a thrown Error whose text is a
// bare string literal.
const SHOWS_LITERAL = /(set[A-Za-z]*(Error|Message|Notice|Status|Failure)\s*\(\s*['"]|toast\.error\s*\(\s*['"]|Alert\.alert\s*\(\s*['"]|alert\s*\(\s*['"]|throw new Error\s*\(\s*['"])/;
const READS_SERVER_TEXT = /\bmessage\b|\breason\b|\bdetail\b/;

// A block that starts at `re` and runs to its matching brace.
function guardedBlocks(source, pattern) {
  const found = [];
  const re = new RegExp(pattern, 'g');
  let m;
  while ((m = re.exec(source)) !== null) {
    const open = source.indexOf('{', m.index);
    if (open < 0 || open > m.index + m[0].length + 2) continue;
    let depth = 1;
    let i = open + 1;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    found.push({
      binding: (m[1] ?? '').replace(/[()]/g, '').trim().split(':')[0].trim(),
      body: source.slice(open + 1, i - 1),
      line: source.slice(0, m.index).split('\n').length,
    });
  }
  return found;
}

function clientFindings(file, source) {
  const rel = relative(repoRoot, file).split('\\').join('/');
  const out = [];
  if (!/fetch\s*\(/.test(source)) {
    return out;
  }

  for (const block of guardedBlocks(source, 'if\\s*\\(\\s*!\\s*[\\w.]+\\.ok\\s*\\)\\s*')) {
    if (SHOWS_LITERAL.test(block.body) && !READS_SERVER_TEXT.test(block.body)) {
      out.push({ rel, line: block.line, kind: 'discards-response', detail: "shows a fixed string instead of the route's message" });
    }
  }

  for (const block of guardedBlocks(source, 'catch\\s*(\\([^)]*\\))?\\s*')) {
    if (!SHOWS_LITERAL.test(block.body)) continue;
    const binding = block.binding;
    const uses = binding.length > 0 && new RegExp(`\\b${binding}\\b`).test(block.body);
    if (!uses) {
      out.push({ rel, line: block.line, kind: 'discards-throw', detail: 'shows a fixed string and never uses the caught value' });
    }
  }

  return out;
}


// ---------------------------------------------------------------------------------------------------
// Everything else that catches: the server libraries, the operational scripts, the shared packages, and
// the native app's modules. Two defects, and one deliberate pattern that is not a defect:
//
//   empty-catch   a catch whose body is empty or only a comment. Nothing is reported, nothing is
//                 returned, nothing is decided — the failure simply never happened as far as the rest
//                 of the program knows.
//   says-nothing  a catch that does real work (retries, cleans up, writes a different value) yet
//                 neither uses the caught value nor logs or reports it, so the reason is gone.
//
// A fallback-only catch (`catch { return null }`, `catch { parsed = null }`) is NOT flagged: there the
// fallback is the answer and the caller can see it. Rule 137 asks such a catch to carry a comment
// saying why the failure is expected — a reviewer's check, not a machine's.
// ---------------------------------------------------------------------------------------------------

const silentRoots = [
  'ctf/packages/web/lib',
  'ctf/scripts',
  'ctf/packages/mobile/src',
  'ctf/packages/shared/src',
];

function sourceFiles(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'dist' && entry !== 'mocks') found.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
      found.push(full);
    }
  }
  return found.sort();
}

const withoutComments = (body) => body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
// The one way out: a catch may leave no trace when the code says why, in the body, as
// `no-trace: <reason>`. Releasing a client that is already gone is a real case; the marker makes the
// decision visible and greppable instead of invisible. A bare "ignore" comment is not enough.
const NO_TRACE_MARKER = /no-trace:\s*\S+\s+\S+/;
// `return <constant>` / `<name> = <constant>` and the loop-control keywords: the fallback IS the answer.
// A catch whose whole body is one `return` or one assignment is not hiding anything: producing the
// alternative value IS its job, and the caller sees that value. `return null`, `return { ok: false,
// reason: 'not_a_zip' }`, `reporter = createNoopReporter()` — all decided outcomes. Rule 137 asks such a
// catch to carry a comment saying why the failure is expected; that is a reviewer's check, not a
// machine's. Anything longer than one statement is doing work, and then the reason has to be recorded.
function isFallbackOnly(bare) {
  // Blank out string bodies first: a semicolon inside a message ("… output; needs mapping") would
  // otherwise read as two statements and the single-return case would be missed.
  const flattened = bare
    .replace(/'(?:\\.|[^'])*'/g, "''")
    .replace(/"(?:\\.|[^"])*"/g, '""')
    .replace(/`(?:\\.|[^`])*`/g, '``');
  const statements = flattened.split(';').map((part) => part.trim()).filter((part) => part.length > 0);
  if (statements.length !== 1) return false;
  const only = statements[0];
  if (/^(break|continue)$/.test(only)) return true;
  return /^return\b/.test(only) || /^[A-Za-z_$][\w$.[\]']*\s*=[^=]/.test(only);
}

const SAYS_SOMETHING = /reportError\s*\(|console\.(error|warn|log)\s*\(|captureException\s*\(/;

function silentFindings(file, source) {
  const rel = relative(repoRoot, file).split('\\').join('/');
  const out = [];
  for (const block of catchBlocks(source)) {
    const binding = block.binding;
    if (binding.length > 0 && new RegExp(`\\b${binding}\\b`).test(block.body)) continue;
    if (/\bthrow\b/.test(block.body)) continue; // re-thrown: the reason travels with it
    if (NO_TRACE_MARKER.test(block.body)) continue; // deliberate and stated
    const bare = withoutComments(block.body);
    if (bare.length === 0) {
      out.push({ rel, line: block.line, kind: 'empty-catch', detail: 'catch body is empty — the failure leaves no trace' });
      continue;
    }
    if (isFallbackOnly(bare)) continue;
    if (!SAYS_SOMETHING.test(block.body)) {
      out.push({ rel, line: block.line, kind: 'says-nothing', detail: 'catch does work but neither uses nor reports the caught value' });
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
  for (const root of clientRoots) {
    for (const file of clientFiles(join(repoRoot, root))) {
      const results = clientFindings(file, readFileSync(file, 'utf8'));
      if (results.length === 0) continue;
      counts.set(results[0].rel, (counts.get(results[0].rel) ?? 0) + results.length);
      all.push(...results);
    }
  }
  for (const root of silentRoots) {
    for (const file of sourceFiles(join(repoRoot, root))) {
      const results = silentFindings(file, readFileSync(file, 'utf8'));
      if (results.length === 0) continue;
      counts.set(results[0].rel, (counts.get(results[0].rel) ?? 0) + results.length);
      all.push(...results);
    }
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
  console.log(`check-error-verbosity: ${all.length} finding(s) across ${counts.size} file(s) (routes + client surfaces).`);
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
  console.error('\nFix, on a route: answer with failureResponse({ summary, error, code, area, op }) from');
  console.error("lib/errors/failure.ts, or include withReason('…', error) in the message.");
  console.error("Fix, on a screen: show the route's message (data?.message ?? your fallback), and pass a");
  console.error('caught value to reportError so it is not lost. Do not add an allowlist entry — the');
  console.error('burn-down list only shrinks.');
  process.exit(1);
}

main();
