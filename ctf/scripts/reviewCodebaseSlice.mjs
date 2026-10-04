#!/usr/bin/env node
// Review ONE slice of the codebase and file GitHub issues for the findings.
//
// This is the "code review" half of an incremental review pipeline that runs on a schedule
// (or by hand) instead of on every merge:
//
//   1. Discover slices. Folders are grouped by NAME across the source layers (app/api,
//      components, lib, mobile/src/features; a page folder under app/ joins a slice of the same
//      name). A name that appears in several layers is a plugin and is reviewed as ONE holistic
//      slice (its API + server logic + web UI + mobile feature together), so cross-layer bugs are
//      visible. A name that appears in only one layer is a standalone module (e.g. `auth`, `ui`,
//      `chatbot`) and is its own slice, so features outside any plugin still get reviewed.
//      Everything that no grouped slice claims lands in a catch-all slice (`web-pages`,
//      `web-shell`, `mobile-shell`, one per other workspace package, `scripts`, `sql`, and
//      `ctf-root` for whatever is left), so every source file under ctf/ belongs to exactly one
//      slice. Before the catch-alls, 343 files — the admin pages, the plugin shell page, the
//      middleware, every script and migration — were in no slice and were never reviewed.
//   2. Pick the slice to review: an in-progress (partial) slice first, then one with findings
//      left over from a capped run, then any never-reviewed slice, then the least-recently-
//      reviewed one. This guarantees every slice gets at least one pass before any gets a second.
//   3. Send that slice's source to Claude (up to a per-run byte budget), along with two read-only
//      references — the plugin's declared contracts, and the code the slice imports from OUTSIDE
//      itself — and ask for concrete, high-signal findings, including mismatches between the layers
//      and code that violates a contract.
//
//      The imported-code reference matters because a slice is a set of same-named folders, which
//      does not hold for a surface built on another plugin's server code: the Commons slice is
//      app/api/commons + lib/commons, while every function its routes call lives in lib/feed. The
//      reviewer used to read those call sites with no way to open the implementations, and filed
//      confident, wrong findings about validation and error handling that were present one layer
//      down (issues #2205, #2206, #2208). See ctf/scripts/lib/sliceImports.mjs.
//   4. File one GitHub issue per finding, labeled `code-review`. Findings the model judges
//      to have a small, safe, self-contained fix also get `code-review:actionable`, which
//      the implement workflow can turn into a pull request. Findings past the per-run issue cap
//      are kept on the slice's ledger row and filed by the next run(s) before anything else is
//      reviewed — they used to be dropped until the slice came round again.
//   5. Stamp the slice in the rotation ledger. A slice too big for one run carries over:
//      its remaining files are reviewed on the next run(s), and it is only marked fully
//      reviewed once every file has been covered (nothing is silently dropped). The resume point
//      is the path of the next file, not an index, so a file added or removed between runs does
//      not shift it.
//
// It never writes code or opens a PR.
//
// The ledger has two copies and they are merged on read. The scheduled sweep keeps its copy on
// the `code-review-ledger` branch; the hand route (`/rs`) stamps the copy on main. Each run reads
// its own copy plus every path in CODE_REVIEW_LEDGER_MERGE_PATHS and, slice by slice, keeps the
// newer stamp — so a slice reviewed by hand is not reviewed again by the next funded run, and a
// slice the funded run covered is not picked by hand. Before the merge the two copies drifted for
// months and nine hand-reviewed slices read as never reviewed on the branch.
//
// Modes (the first argument):
//   (none)                       Review one slice and file issues. Needs ANTHROPIC_API_KEY and
//                                GH_TOKEN; a missing one FAILS the run (it used to exit 0 with
//                                "nothing to do", which made a lost secret look like a green run).
//   --pick [slice] [--json]      Print the slice the sweep would review next (or the named one):
//                                its folders, files, resume point, leftover findings, and which
//                                slices are new or never reviewed. No model call, no secrets. This
//                                is how `/rs` chooses, so the hand route runs the same discovery
//                                and sees slices the ledger file does not list yet.
//   --stamp <slice> [--issues N] Mark the slice fully reviewed now (clears partial state and
//                                leftover findings) and save the reconciled ledger. For `/rs`.
//   --reconcile                  Merge, reconcile against the current folders, and save. No stamp.
//   --fingerprint <slice> <title>  Print the dedupe fingerprint the sweep embeds in an issue body.
//
// Required environment (review mode):
//   ANTHROPIC_API_KEY    For the model call.
//   GH_TOKEN             A token with `issues: write` on the repo (the Actions token is fine).
//
// Optional environment:
//   GITHUB_REPOSITORY      owner/repo (default: chargingthefuture/chargingthefuture).
//   CODE_REVIEW_MODEL      Model id (default: claude-sonnet-4-6). Use a cheaper model to cut cost.
//   CODE_REVIEW_SLICE      Review this exact plugin/module name instead of the rotation pick.
//   CODE_REVIEW_MAX_ISSUES Most issues to file in one run (default: 8). Highest severity first;
//                          the rest carry over to the next run on the ledger row.
//   CODE_REVIEW_MAX_BYTES  Per-run source byte budget (default: 200000 ≈ most entire plugins).
//   CODE_REVIEW_CONTRACTS_MAX_BYTES  Cap on contract reference bytes (default: 60000).
//   CODE_REVIEW_DEPS_MAX_BYTES  Cap on imported-code reference bytes (default: 90000; 0 disables).
//   CODE_REVIEW_LEDGER_PATH  The ledger to read and write (default: ctf/config/code-review-ledger.json).
//   CODE_REVIEW_LEDGER_MERGE_PATHS  Comma-separated extra ledger copies merged on read (newer
//                          stamp per slice wins). A listed path that does not exist is skipped
//                          with a log line; one that exists but cannot be parsed fails the run.
//   CODE_REVIEW_EXISTING_ISSUES_LIMIT  Most `code-review` issues fetched for dedupe (default:
//                          10000). Hitting the limit fails the run rather than refiling dismissed
//                          findings the fetch could not see.
//   CODE_REVIEW_DRY_RUN    "1" to print findings without filing issues or touching the ledger.
//
// In GitHub Actions the review mode writes `slice`, `completed_slice` (empty when the run was
// partial or only filed leftovers) and `filed` to $GITHUB_OUTPUT, so later steps that should
// follow a COMPLETED review — the manual test-script refresh — can be gated on it.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDependencyContext } from './lib/sliceImports.mjs';
import { anthropicApiError, reportIfRunBlocked } from './lib/anthropicRunBlocked.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const DEFAULT_LEDGER_REL = 'ctf/config/code-review-ledger.json';
const ledgerPath = process.env.CODE_REVIEW_LEDGER_PATH
  ? resolve(process.env.CODE_REVIEW_LEDGER_PATH)
  : join(repoRoot, DEFAULT_LEDGER_REL);
const ledgerMergePaths = (process.env.CODE_REVIEW_LEDGER_MERGE_PATHS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((p) => resolve(p));
const manifestPath = join(repoRoot, 'ctf/config/code-review-slice-manifest.json');

const REPO = (process.env.GITHUB_REPOSITORY || 'chargingthefuture/chargingthefuture').trim();
const MODEL = (process.env.CODE_REVIEW_MODEL || 'claude-sonnet-4-6').trim();
const MAX_ISSUES = Number(process.env.CODE_REVIEW_MAX_ISSUES || '8');
const MAX_BYTES = Number(process.env.CODE_REVIEW_MAX_BYTES || '200000');
const CONTRACTS_MAX_BYTES = Number(process.env.CODE_REVIEW_CONTRACTS_MAX_BYTES || '60000');
// Budget for code the slice imports from OUTSIDE itself, sent as read-only reference. Separate from
// the source budget so pulling in a dependency never costs the slice its own coverage. Set to 0 to
// turn the dependency context off.
//
// 70000 was calibrated when extracted declarations were, through a bug, only their signatures. Now
// that they carry their bodies — which is the point, since the reasoning a reviewer needs is
// inside the function — the same set of dependencies costs more. Measured on the commons slice: at
// 70000 two files are dropped, at 90000 all 16 fit.
const DEPS_MAX_BYTES = Number(process.env.CODE_REVIEW_DEPS_MAX_BYTES || '90000');
// The model's findings JSON must fit in one response. 4000 was too small for a full-plugin
// review: the JSON truncated mid-string and JSON.parse threw, failing the entire run. Give it ample
// room (Sonnet allows far more), overridable for cost tuning.
const MAX_OUTPUT_TOKENS = Number(process.env.CODE_REVIEW_MAX_OUTPUT_TOKENS || '16000');
// Every `code-review` issue ever filed is read for dedupe. The old fixed limit of 500 was passed
// in October 2026 (527 issues), and the oldest 27 — all workforce findings — fell outside it, so
// their dismissals were invisible and the next workforce pass would have refiled them.
const EXISTING_ISSUES_LIMIT = Number(process.env.CODE_REVIEW_EXISTING_ISSUES_LIMIT || '10000');
const DRY_RUN = process.env.CODE_REVIEW_DRY_RUN === '1';
// How long a won't-fix (closed as "not planned") finding stays suppressed before a recurrence is
// re-surfaced for a fresh decision. Dedup keys off the finding TITLE, not the code, so a dismissal is
// "not now", not "never": after this window the code may have changed and the call may differ. A
// finding that was closed via a fix (completed) has no window — if it recurs it is a regression and is
// re-surfaced immediately. 0 disables the window (won't-fix suppressed forever).
const WONTFIX_REVISIT_DAYS = Number(process.env.CODE_REVIEW_WONTFIX_DAYS || '90');

// A plugin's declared contracts are sent as read-only reference so the reviewer can check
// the code against them. Looked up by exact filename; the prefix defaults to the slice name
// upper-snake-cased, but a slice whose contracts live under another name declares the real prefix
// in the slice manifest. Modules with genuinely no contracts simply get none. Sent on every run for
// the slice, separate from the code byte budget, and capped so they don't crowd out the code.
const CONTRACTS_DIR = 'ctf/docs/contracts';
const CONTRACT_SUFFIXES = [
  '_PLUGIN_COMMAND_CONTRACTS.yaml',
  '_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml',
  '_PLUGIN_AUDIT_CONTRACTS.yaml',
  '_PROFILE_AND_DELETION_CONTRACT.md',
];

// Folders with the same name under these layers are grouped into one slice. A name in two
// or more layers is treated as a plugin; a name in one layer is a standalone module.
//
// `joinOnly` roots never start a slice of their own: a page folder under app/ or app/apps/
// (app/admin, app/account, app/apps/directory) joins the slice that already carries its name, so
// the screen is read beside the routes and server code it renders. A page folder matching no slice
// (app/guide, app/sign-in, app/apps/[pluginSlug]) is left to the `web-pages` catch-all below
// rather than becoming a one-file slice that costs a run of its own.
const GROUPED_ROOTS = [
  { root: 'ctf/packages/web/app/api' },
  { root: 'ctf/packages/web/components' },
  { root: 'ctf/packages/web/lib' },
  { root: 'ctf/packages/mobile/src/features' },
  { root: 'ctf/packages/web/app', skip: ['api', 'apps'], joinOnly: true },
  { root: 'ctf/packages/web/app/apps', joinOnly: true },
];

// Catch-all slices, applied in this order after the grouped slices: every source file under the
// base(s) that no earlier slice claimed. Workspace packages other than web and mobile are added
// between `mobile-shell` and `scripts`, one slice each (`shared-package`, `eol-package`, ...).
// `ctf-root` is last and takes whatever is left anywhere under ctf/, so a new folder can never
// sit outside the rotation.
const CATCH_ALL_SLICES = [
  { name: 'web-pages', bases: ['ctf/packages/web/app'], note: 'page folders matching no slice, plus the app root files' },
  { name: 'web-shell', bases: ['ctf/packages/web'], note: 'middleware, instrumentation, config, hooks, scripts, src — every web file in no other slice' },
  { name: 'mobile-shell', bases: ['ctf/packages/mobile'], note: 'the native app outside src/features: entry point, auth, theme, components, config' },
  { name: 'scripts', bases: ['ctf/scripts'], note: 'operational scripts, CI gates and the AI workflow scripts' },
  { name: 'sql', bases: ['ctf/db', 'ctf/ops', 'ctf/schema.sql'], note: 'the schema, migrations and ops SQL' },
  { name: 'ctf-root', bases: ['ctf'], note: 'anything under ctf/ that no other slice claims' },
];
const PACKAGES_DIR = 'ctf/packages';
const PACKAGES_WITH_OWN_SLICES = new Set(['web', 'mobile']);

// Files that match a source extension but are not source. Each is logged once per run so an
// exclusion is visible rather than silent.
const EXCLUDED_FILES = [
  { pattern: /^ctf\/schema\.demo\.sql$/, reason: 'generated demo seed dump' },
  { pattern: /^ctf\/schema-prod[^/]*\.sql$/, reason: 'production schema snapshot, not maintained source' },
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.sql'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '__snapshots__', '.turbo']);
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };
const FINDING_FIELDS = ['title', 'severity', 'category', 'files', 'summary', 'recommendation', 'actionable'];

const argv = process.argv.slice(2);
const MODE = argv[0] && argv[0].startsWith('--') ? argv[0] : null;
const MODE_ARGS = MODE ? argv.slice(1) : argv;
// A forced slice comes from the environment (the workflow's dispatch input) or from `--pick <name>`.
const FORCED_SLICE = (
  (MODE === '--pick' ? MODE_ARGS.find((a) => !a.startsWith('--')) : '') || process.env.CODE_REVIEW_SLICE || ''
).trim();

// Progress notes. In `--pick --json` they go to stderr so stdout is only the JSON document.
const NOTES_TO_STDERR = MODE === '--pick' && MODE_ARGS.includes('--json');
function note(message) {
  (NOTES_TO_STDERR ? console.error : console.log)(message);
}

function gh(args, options = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', ...options });
}

// The explicit slice manifest: contract prefixes and former folder names that cannot be derived
// from the slice name. Missing or malformed, every slice falls back to the derived default, which
// is what the sweep did before the manifest existed — a bad manifest degrades the review, it does
// not fail the run.
function loadSliceManifest() {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return parsed && typeof parsed.slices === 'object' && parsed.slices !== null ? parsed.slices : {};
  } catch (error) {
    console.warn(`reviewCodebaseSlice: slice manifest unreadable (${error?.message || error}); using derived defaults.`);
    return {};
  }
}

const SLICE_MANIFEST = loadSliceManifest();

// Which `ctf/docs/contracts/<PREFIX>_*` files govern this slice. Default: the slice name
// upper-snake-cased. A slice served by another plugin's contracts declares the real prefix, because
// silently finding none leaves the reviewer to invent what the contract says.
function contractPrefixFor(sliceName) {
  const declared = SLICE_MANIFEST[sliceName]?.contractPrefix;
  return (typeof declared === 'string' && declared.trim().length > 0
    ? declared.trim()
    : sliceName
  ).toUpperCase().replace(/-/g, '_');
}

// Every name this slice's issues may be titled with: its current name plus any former folder names.
// Without the aliases a rename hides all earlier decisions, and findings dismissed under the old
// name are filed again as new.
function sliceTitleNames(sliceName) {
  const aliases = SLICE_MANIFEST[sliceName]?.aliases;
  const names = [sliceName];
  if (Array.isArray(aliases)) {
    for (const alias of aliases) {
      if (typeof alias === 'string' && alias.trim() && !names.includes(alias.trim())) {
        names.push(alias.trim());
      }
    }
  }
  return names;
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false; // no-trace: a missing path is simply not a directory.
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false; // no-trace: a missing path is simply not a file.
  }
}

function walkSourceFiles(dirAbs, out) {
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        walkSourceFiles(join(dirAbs, entry.name), out);
      }
      continue;
    }
    const name = entry.name;
    if (name.endsWith('.d.ts') || name.endsWith('.min.js')) {
      continue;
    }
    if (SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      out.push(join(dirAbs, name));
    }
  }
  return out;
}

// Source files under a repo-relative folder or a single file, as [{abs, rel}].
function sourceFilesUnder(rel) {
  const abs = join(repoRoot, rel);
  const found = [];
  if (isDir(abs)) {
    walkSourceFiles(abs, found);
  } else if (isFile(abs) && SOURCE_EXTENSIONS.some((ext) => abs.endsWith(ext))) {
    found.push(abs);
  }
  return found.map((a) => ({ abs: a, rel: relative(repoRoot, a) }));
}

function byRel(a, b) {
  return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0;
}

function excludedReason(rel) {
  const hit = EXCLUDED_FILES.find((e) => e.pattern.test(rel));
  return hit ? hit.reason : null;
}

// Every slice in the codebase: Map of name -> { name, type, paths, files, note }.
// `paths` are the folders (or, for a catch-all, the bases) shown to the reviewer and in the issue
// body; `files` is the deterministic, sorted, repo-relative file list the run walks.
// Also returns the excluded files it saw, so a run can log them.
function discoverSlices() {
  const byName = new Map();
  const claimed = new Set();
  const excluded = [];

  const claimFiles = (files) => {
    const kept = [];
    for (const f of files) {
      if (claimed.has(f.rel)) continue;
      const reason = excludedReason(f.rel);
      if (reason) {
        excluded.push({ rel: f.rel, reason });
        claimed.add(f.rel);
        continue;
      }
      claimed.add(f.rel);
      kept.push(f);
    }
    return kept;
  };

  const subfolders = (root) => {
    const rootAbs = join(repoRoot, root);
    if (!isDir(rootAbs)) return [];
    return readdirSync(rootAbs)
      .filter((name) => !SKIP_DIRS.has(name) && !name.startsWith('.') && isDir(join(rootAbs, name)))
      .sort();
  };

  // Pass 1: roots that start slices.
  for (const { root, skip = [], joinOnly } of GROUPED_ROOTS) {
    if (joinOnly) continue;
    for (const name of subfolders(root)) {
      if (skip.includes(name)) continue;
      if (!byName.has(name)) {
        byName.set(name, { name, type: 'module', paths: [], files: [], note: '' });
      }
      byName.get(name).paths.push(`${root}/${name}`);
    }
  }
  // Pass 2: roots whose folders only join a slice that already exists.
  for (const { root, skip = [], joinOnly } of GROUPED_ROOTS) {
    if (!joinOnly) continue;
    for (const name of subfolders(root)) {
      if (skip.includes(name) || !byName.has(name)) continue;
      byName.get(name).paths.push(`${root}/${name}`);
    }
  }
  for (const slice of byName.values()) {
    slice.paths.sort();
    slice.type = slice.paths.length >= 2 ? 'plugin' : 'module';
    slice.files = claimFiles(slice.paths.flatMap((p) => sourceFilesUnder(p))).sort(byRel);
  }

  // Pass 3: catch-alls, in order, over whatever is still unclaimed.
  const catchAlls = [...CATCH_ALL_SLICES];
  const packagesAbs = join(repoRoot, PACKAGES_DIR);
  const otherPackages = isDir(packagesAbs)
    ? readdirSync(packagesAbs)
      .filter((name) => !name.startsWith('.') && !PACKAGES_WITH_OWN_SLICES.has(name) && isDir(join(packagesAbs, name)))
      .sort()
      .map((name) => ({ name: `${name}-package`, bases: [`${PACKAGES_DIR}/${name}`], note: `the @ctf/${name} workspace package` }))
    : [];
  const scriptsIdx = catchAlls.findIndex((c) => c.name === 'scripts');
  catchAlls.splice(scriptsIdx, 0, ...otherPackages);

  for (const { name, bases, note } of catchAlls) {
    if (byName.has(name)) {
      throw new Error(`Catch-all slice name '${name}' collides with a folder-derived slice; rename one of them.`);
    }
    const files = claimFiles(bases.flatMap((b) => sourceFilesUnder(b))).sort(byRel);
    if (files.length === 0) continue;
    byName.set(name, {
      name,
      type: 'module',
      paths: bases.map((b) => `${b} (every file in no other slice)`),
      files,
      note,
    });
  }

  return { slices: byName, excluded };
}

// ---------------------------------------------------------------------------------------------
// Ledger: load (merging copies), reconcile against discovery, pick, stamp, save.

function readLedgerFile(path, { required }) {
  if (!existsSync(path)) {
    if (required) return { slices: [] };
    note(`reviewCodebaseSlice: ledger copy ${path} does not exist; nothing to merge from it.`);
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    // A copy that exists but cannot be read is not something to skip: skipping it would drop every
    // stamp it holds and review those slices again. Fail so the run can be retried.
    throw new Error(`Ledger ${path} exists but could not be parsed: ${error?.message || error}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Ledger ${path} is not a JSON object.`);
  }
  if (!Array.isArray(parsed.slices)) {
    parsed.slices = [];
  }
  return parsed;
}

function stampTime(row) {
  const t = Date.parse(row?.lastReviewedAt || '');
  return Number.isNaN(t) ? 0 : t;
}

// Of two rows for the same slice, the one whose state is further along: the newer completion
// stamp wins; on the same stamp, in-progress state (a partial pass, leftover findings) carries
// more than none; a true tie keeps the primary copy's row.
function furtherAlongRow(primary, other) {
  const tp = stampTime(primary);
  const to = stampTime(other);
  if (tp !== to) return tp > to ? primary : other;
  if (Boolean(primary.partial) !== Boolean(other.partial)) return primary.partial ? primary : other;
  const dp = Array.isArray(primary.deferred) ? primary.deferred.length : 0;
  const dOther = Array.isArray(other.deferred) ? other.deferred.length : 0;
  if (dp !== dOther) return dp > dOther ? primary : other;
  return primary;
}

function mergeLedgers(primary, other, otherPath) {
  const rows = new Map(primary.slices.map((s) => [s.name, s]));
  const taken = [];
  for (const row of other.slices) {
    if (!row || typeof row.name !== 'string') continue;
    const mine = rows.get(row.name);
    if (!mine) {
      rows.set(row.name, row);
      taken.push(row.name);
      continue;
    }
    const winner = furtherAlongRow(mine, row);
    if (winner !== mine) {
      rows.set(row.name, row);
      taken.push(row.name);
    }
  }
  primary.slices = [...rows.values()];
  note(
    `reviewCodebaseSlice: merged ledger copy ${otherPath}` +
      (taken.length ? ` — it was further along for: ${taken.join(', ')}.` : ' — nothing in it was newer.'),
  );
  return primary;
}

function loadLedger() {
  const ledger = readLedgerFile(ledgerPath, { required: true });
  for (const path of ledgerMergePaths) {
    if (path === ledgerPath) continue;
    const other = readLedgerFile(path, { required: false });
    if (other) mergeLedgers(ledger, other, path);
  }
  return ledger;
}

// Write rows in a fixed shape. Earlier runs persisted a `paths` array onto each row by accident
// (51 of 64 rows carried one, going out of date on every rename); only the rotation fields are
// written now, and the in-progress fields only while they mean something.
function normalizeRow(row, discoveredType) {
  const out = {
    name: row.name,
    type: discoveredType || row.type || 'module',
    lastReviewedAt: typeof row.lastReviewedAt === 'string' ? row.lastReviewedAt : null,
    lastRunIssues: Number.isFinite(row.lastRunIssues) ? row.lastRunIssues : 0,
    cursor: Number.isFinite(row.cursor) ? row.cursor : 0,
    partial: row.partial === true,
  };
  if (out.partial && typeof row.nextFile === 'string' && row.nextFile) {
    out.nextFile = row.nextFile;
  }
  if (!out.partial) {
    out.cursor = 0;
  }
  const deferred = Array.isArray(row.deferred) ? row.deferred.filter((f) => f && typeof f.title === 'string') : [];
  if (deferred.length > 0) {
    out.deferred = deferred.map(compactFinding);
  }
  return out;
}

function compactFinding(finding) {
  const out = {};
  for (const key of FINDING_FIELDS) {
    if (finding[key] !== undefined) out[key] = finding[key];
  }
  return out;
}

// Keep rotation state for every discovered slice; drop slices whose folders are all gone.
// Returns the slice names added and pruned so a run can say what changed.
function reconcileSlices(ledger, discovered) {
  const known = new Map(ledger.slices.map((s) => [s.name, s]));
  const result = [];
  const added = [];
  for (const name of [...discovered.keys()].sort()) {
    const type = discovered.get(name).type;
    const existing = known.get(name);
    if (existing) {
      result.push(normalizeRow(existing, type));
    } else {
      result.push(normalizeRow({ name }, type));
      added.push(name);
    }
  }
  const pruned = [...known.keys()].filter((name) => !discovered.has(name)).sort();
  ledger.slices = result;
  return { ledger, added, pruned };
}

function saveLedger(ledger) {
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

// In-progress (partial) slice first, then one with leftover findings to file, then never-reviewed
// (by name, so the order is stable), then least-recently-reviewed. Returns { row, reason }.
function pickSlice(ledger, discovered) {
  if (FORCED_SLICE) {
    // Resolve the forced name tolerantly: trim + lowercase both sides so `Workforce`,
    // `workforce`, and ` workforce ` all match the `workforce` slice (slice/folder names are
    // already lowercase, so lowercasing the comparison is safe).
    const wanted = FORCED_SLICE.toLowerCase();
    const resolvedName = [...discovered.keys()].find((name) => name.trim().toLowerCase() === wanted);
    if (!resolvedName) {
      // A forced slice that matches no discovered folder used to fall through to a no-op review
      // of nothing. Fail loudly instead, before any model call or ledger write.
      const valid = [...discovered.keys()].sort().join(', ');
      throw new Error(`Unknown slice '${FORCED_SLICE}'. Valid slices: ${valid}`);
    }
    const row = ledger.slices.find((s) => s.name === resolvedName);
    return { row, reason: `named explicitly (${FORCED_SLICE})` };
  }
  const partial = ledger.slices.find((s) => s.partial);
  if (partial) {
    return { row: partial, reason: `in progress — resumes at ${partial.nextFile || `file index ${partial.cursor}`}` };
  }
  const deferred = ledger.slices.find((s) => Array.isArray(s.deferred) && s.deferred.length > 0);
  if (deferred) {
    return { row: deferred, reason: `${deferred.deferred.length} finding(s) left over from its last run are still to file` };
  }
  const sorted = [...ledger.slices].sort((a, b) => {
    const ta = stampTime(a);
    const tb = stampTime(b);
    if (ta !== tb) return ta - tb;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  const row = sorted[0] || null;
  if (!row) return { row: null, reason: 'no slices' };
  return {
    row,
    reason: row.lastReviewedAt ? `least recently reviewed (${row.lastReviewedAt})` : 'never reviewed',
  };
}

// Where a partial pass resumes. The ledger records the path of the next file to cover; the file
// list is sorted, so if that file was removed the pass continues from the first file after it.
// An index is kept only for ledgers written before paths were recorded.
function resumeIndex(row, files) {
  if (!row.partial) return 0;
  if (typeof row.nextFile === 'string' && row.nextFile) {
    const idx = files.findIndex((f) => f.rel >= row.nextFile);
    if (idx === -1) {
      note(`reviewCodebaseSlice: every file from ${row.nextFile} onward is gone; starting ${row.name} from the top.`);
      return 0;
    }
    if (files[idx].rel !== row.nextFile) {
      note(`reviewCodebaseSlice: ${row.nextFile} is gone; ${row.name} resumes at ${files[idx].rel}.`);
    }
    return idx;
  }
  if (Number.isFinite(row.cursor) && row.cursor > 0 && row.cursor < files.length) {
    return row.cursor;
  }
  return 0;
}

function markComplete(row, filed) {
  row.lastReviewedAt = new Date().toISOString();
  row.lastRunIssues = filed;
  row.cursor = 0;
  row.partial = false;
  delete row.nextFile;
}

function writeGithubOutput(pairs) {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) return;
  appendFileSync(path, Object.entries(pairs).map(([k, v]) => `${k}=${v}\n`).join(''));
}

// ---------------------------------------------------------------------------------------------
// Gathering what the reviewer reads.

// Concatenate files from `cursor` up to the byte budget, with a header per file. A single
// file larger than the budget is included truncated so the run always makes progress.
function gatherChunk(fileList, cursor, budget) {
  let text = '';
  let i = cursor;
  let truncatedFile = null;
  for (; i < fileList.length; i++) {
    const { abs, rel } = fileList[i];
    const header = `\n===== FILE: ${rel} =====\n`;
    if (text.length > 0 && text.length + header.length >= budget) {
      break;
    }
    let body = readFileSync(abs, 'utf8');
    const room = budget - text.length - header.length;
    if (body.length > room) {
      if (text.length === 0) {
        body = `${body.slice(0, Math.max(room, 0))}\n... (file truncated to fit the run budget) ...`;
        truncatedFile = rel;
        text += header + body;
        i += 1;
      }
      break;
    }
    text += header + body;
  }
  const complete = i >= fileList.length;
  return { text, startIdx: cursor, endIdx: i, nextCursor: complete ? 0 : i, complete, truncatedFile };
}

// A plugin's declared contracts (by exact filename), as read-only reference text.
function gatherContracts(sliceName) {
  const prefix = contractPrefixFor(sliceName);
  let text = '';
  const files = [];
  for (const suffix of CONTRACT_SUFFIXES) {
    if (text.length >= CONTRACTS_MAX_BYTES) {
      break;
    }
    const rel = `${CONTRACTS_DIR}/${prefix}${suffix}`;
    let body;
    try {
      body = readFileSync(join(repoRoot, rel), 'utf8');
    } catch {
      continue; // no-trace: this contract does not exist for this slice.
    }
    const header = `\n----- CONTRACT: ${rel} -----\n`;
    const room = CONTRACTS_MAX_BYTES - text.length - header.length;
    if (room <= 0) {
      break;
    }
    if (body.length > room) {
      body = `${body.slice(0, room)}\n... (contract truncated) ...`;
    }
    text += header + body;
    files.push(rel);
  }
  return { text, files };
}

function buildAlreadyTrackedBlock(existingFindings) {
  if (!existingFindings || existingFindings.length === 0) {
    return [];
  }
  // Newest first (gh order); cap so the list never crowds out the source budget.
  const lines = existingFindings.slice(0, 60).map((e) => {
    const state = e.state === 'closed'
      ? (e.stateReason === 'completed' ? 'closed: fixed' : 'closed: dismissed')
      : 'open';
    return `- [${state}] ${e.title}: ${e.summary}`;
  });
  return [
    '',
    'ALREADY-TRACKED findings for this slice (each is tracked on its own GitHub issue — do NOT refile these):',
    ...lines,
  ];
}

// The repo's plain-voice rules (CLAUDE.md "Voice — no pleasantries, no feelings") are enforced on
// human-facing agent output by the Stop hook .claude/hooks/check-no-pleasantries.mjs, which holds the
// CANONICAL banned-term list. This sweep's findings are human-facing too — they become GitHub issue
// titles and bodies — but they are produced by a separate model call the Stop hook never sees, which is
// how a banned word reaches a filed issue (e.g. issue #1938). Derive the same terms from that canonical
// file at runtime and fold them into the review prompt, so there is ONE source of truth, not a second
// copy that drifts. Defensive: any read/parse failure falls back to a general plain-language line rather
// than failing the review.
function loadPlainLanguageRules() {
  const fallback = [
    'PLAIN-LANGUAGE RULE (repository voice): write every field in plain, factual language. No',
    'pleasantries, sign-offs, or first-person feeling words. Prefer the simple word, and name the',
    'specific problem instead of a vague label.',
  ];
  try {
    const hookText = readFileSync(join(repoRoot, '.claude/hooks/check-no-pleasantries.mjs'), 'utf8');
    // Each VOCABULARY entry is one line: `{ re: /\bWORD\b.../i, use: 'REPLACEMENT' },`
    const vocab = [];
    const entryRe = /re:\s*\/\\b([^\\/]+?)\\b[^,]*,\s*use:\s*'([^']*)'/g;
    let m;
    while ((m = entryRe.exec(hookText)) !== null) {
      vocab.push({ term: m[1].trim(), use: m[2].trim() });
    }
    if (vocab.length === 0) {
      return fallback;
    }
    return [
      'PLAIN-LANGUAGE RULE (repository voice — enforced on all human-facing agent output; your findings',
      'become GitHub issues, so they must follow it too):',
      '  - Write every field in plain, factual language. No pleasantries, sign-offs, or first-person',
      '    feeling words (no "thanks", "glad", "happy to", "sorry", "hope this/that", etc.).',
      '  - Do NOT use these banned words in any field — use the replacement instead:',
      ...vocab.map((v) => `      - "${v.term}": ${v.use}`),
      '  - Name the specific problem, not a vague label.',
    ];
  } catch (error) {
    console.warn(`reviewCodebaseSlice: could not derive the banned-term list (${error?.message || error}); using the general rule.`);
    return fallback;
  }
}

async function askClaude(slice, source, chunkNote, contractsText, existingFindings = [], depsText = '') {
  const layers = slice.paths.join('\n  ');
  const system = [
    'You are a senior engineer doing a code review of one plugin/module of "Charging the',
    'Future", an open-source Next.js + React Native app. Follow the repository rules in CLAUDE.md.',
    '',
    'You are shown the entire slice across its layers at once. Look hard for bugs that live at',
    'the SEAMS between layers, not just within one file:',
    '  - the API route returns one shape but the web component or mobile screen expects another;',
    "  - a lib/server function's contract changed but a caller still uses the old shape;",
    '  - an auth, permission, or input-validation check present on one path but missing on another;',
    '  - web and mobile implementing the same feature differently (parity drift).',
    '',
    'When DECLARED CONTRACTS are shown below, treat them as the source of truth and flag code',
    'that violates them:',
    '  - a route/command that reads or writes data not listed in its contract dataAccess;',
    '  - auth/role enforcement on an endpoint that does not match the access-policy contract;',
    '  - a state change the audit contract says must emit an audit event, but the code does not;',
    '  - data the deletion contract says must be removed that the code never deletes.',
    '',
    'Also report within-file problems: real bugs, security/correctness issues, missing error',
    'handling, clear dead code, obvious simplifications, and TypeScript type-safety violations',
    '(no `any` without an eslint-disable + reason).',
    '',
    'IMPORTED CODE, when shown below, is the code this slice calls that lives outside it — often the',
    'repository/server functions its routes depend on. It is REFERENCE, not under review:',
    '  - Read it before claiming a call is unchecked, unvalidated, or unguarded. Much of this slice\'s',
    '    validation, clamping, and error handling lives in the function being called, not at the call',
    '    site, and a wrapper that already catches its own errors cannot throw at the caller.',
    '  - Do NOT file a finding whose fix belongs in an imported file — that file is reviewed as part',
    '    of its own slice. Report only problems in the slice\'s own files.',
    '  - Large imported files show only the declarations this slice uses. Absence of code you were not',
    '    shown is not evidence: if you cannot see the definition you need, do not guess what it does —',
    '    leave the finding out.',
    '',
    'Before reporting any missing check, missing validation, or missing error handling, confirm from',
    'the code you were actually shown that it is missing everywhere, not just at the line you are',
    'looking at. A finding that is wrong costs more than a finding that is never filed.',
    '',
    'You may be given an ALREADY-TRACKED list of findings previously raised for this slice. These are',
    'already tracked elsewhere — do NOT report them again, with two narrow exceptions:',
    '  - a tracked finding marked "closed: fixed" that the CURRENT code shown to you clearly STILL',
    '    exhibits — report it and begin the summary with "Regression:" and point to the exact code;',
    '  - a NEW, distinct problem (even in the same file) that is not the same concern as any tracked one.',
    'Do NOT re-report a tracked finding just because it is similar; if the code already addresses it, or',
    'it was "closed: dismissed", leave it out. When unsure whether something is already tracked, prefer',
    'NOT reporting it.',
    '',
    'Do NOT report pure style or formatting nits, and do not invent problems. If the slice looks',
    'fine, return []. Be specific and brief.',
    '',
    ...loadPlainLanguageRules(),
  ].join('\n');

  const user = [
    `Review the ${slice.type} \`${slice.name}\`. It spans these folders:`,
    `  ${layers}`,
    ...(slice.note ? [`  (${slice.note})`] : []),
    chunkNote,
    ...(contractsText
      ? [
          '',
          'DECLARED CONTRACTS for this plugin (reference — the source of truth for what it may do; not under review):',
          contractsText,
        ]
      : []),
    ...(depsText
      ? [
          '',
          'IMPORTED CODE this slice calls from outside itself (reference — not under review; check the',
          'slice against it before claiming something is unchecked or unhandled):',
          depsText,
        ]
      : []),
    ...buildAlreadyTrackedBlock(existingFindings),
    '',
    'The source files follow, each after a "===== FILE: <path> =====" header. Some long files',
    'may be truncated; do not flag truncation itself as a problem.',
    '',
    source,
    '',
    'Return ONLY a JSON array (no markdown fences, no preamble) of findings. Each finding:',
    '{',
    '  "title": "short, specific, <= 70 chars, no severity prefix",',
    '  "severity": "high" | "medium" | "low",',
    '  "category": "bug" | "security" | "correctness" | "quality" | "simplification" | "docs",',
    '  "files": ["repo/relative/path", ...],   // only paths shown above',
    '  "summary": "what is wrong and why it matters, plain language",',
    '  "recommendation": "the concrete change to make",',
    '  "actionable": true | false   // true ONLY if a small, safe, self-contained fix is obvious',
    '}',
    'Return [] if there is nothing worth filing.',
  ].join('\n');

  return anthropicMessage(system, user, MAX_OUTPUT_TOKENS);
}

// One Anthropic message call. Returns the model's text. Logs (does not throw) on a max_tokens stop,
// since callers salvage truncated output.
async function anthropicMessage(system, user, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) throw await anthropicApiError(response);
  const result = await response.json();
  if (result.stop_reason === 'max_tokens') {
    console.warn('reviewCodebaseSlice: model response hit max_tokens; output may be truncated.');
  }
  return result.content[0].text.trim();
}

function parseFindings(raw) {
  const fenced = raw.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/i);
  const text = (fenced ? fenced[1] : raw).trim();
  try {
    const findings = JSON.parse(text);
    if (!Array.isArray(findings)) {
      throw new Error('Model did not return a JSON array.');
    }
    return findings;
  } catch (error) {
    // The response can be truncated (model hit max_tokens) or otherwise malformed, which used to
    // fail the entire run. Salvage the complete finding objects parsed before the break instead of
    // dropping the entire review. If nothing is recoverable, re-throw the original error.
    const salvaged = salvageFindings(text);
    if (salvaged.length > 0) {
      console.warn(
        `reviewCodebaseSlice: findings JSON was not fully valid (${error?.message || error}); ` +
          `salvaged ${salvaged.length} complete finding(s).`,
      );
      return salvaged;
    }
    throw error;
  }
}

// Recover as many complete top-level objects as possible from a (possibly truncated) JSON array.
// Walks the text tracking string/escape state and brace depth; every time depth returns to 0 at an
// object close, that object is complete and is parsed on its own. A trailing partial object (the
// truncation point) is simply skipped.
function salvageFindings(text) {
  const start = text.indexOf('[');
  if (start === -1) {
    return [];
  }
  const objects = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;
  for (let i = start + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && objStart !== -1) {
        try {
          objects.push(JSON.parse(text.slice(objStart, i + 1)));
        } catch {
          // no-trace: an individually malformed object is skipped rather than fatal.
        }
        objStart = -1;
      }
    }
  }
  return objects;
}

// ---------------------------------------------------------------------------------------------
// Filing: dedupe against every issue ever filed for the slice, then create / reopen.

function fingerprint(sliceName, title) {
  return createHash('sha1').update(`${sliceName}\n${title}`).digest('hex').slice(0, 16);
}

function ensureLabel(name, color, description) {
  try {
    gh(['label', 'create', name, '--repo', REPO, '--color', color, '--description', description, '--force']);
  } catch {
    // no-trace: best-effort, since applying the label at create time is what matters.
  }
}

// Every `code-review` issue this sweep has ever filed for THIS slice, open OR closed. Reading closed
// issues too is what makes "close it" a durable decision (a dismissed/fixed finding is matched, not
// re-filed). We match on substance via the model (judgeDuplicates), not on the issue title — an LLM
// rewrites the title every run, so a text fingerprint would miss a reworded re-flag. The embedded
// fingerprint is kept only as a cheap exact-match fast path.
//
// A failed fetch THROWS. It used to return [] and carry on, which filed every finding of the run
// as new — the one outcome dedupe exists to prevent. The ledger is not advanced on a throw, so the
// next run simply reviews the same slice again.
function existingSliceIssues(sliceName) {
  // Match this slice's current name AND any former folder name it declares, so a rename does not
  // hide the decisions already made (issue #2207 was #1876 refiled after api/hub became
  // api/commons — the code had not changed and the finding had already been rejected).
  const titlePrefixes = sliceTitleNames(sliceName).map((name) => `Code review (${name}):`);
  let raw;
  try {
    raw = gh([
      'issue', 'list', '--repo', REPO, '--label', 'code-review', '--state', 'all',
      '--json', 'number,title,state,stateReason,closedAt,body', '--limit', String(EXISTING_ISSUES_LIMIT),
    ]);
  } catch (error) {
    throw new Error(`Could not list existing code-review issues for dedupe: ${error?.message || error}`);
  }
  const all = JSON.parse(raw);
  if (all.length >= EXISTING_ISSUES_LIMIT) {
    throw new Error(
      `The repo has at least ${EXISTING_ISSUES_LIMIT} code-review issues, which is the fetch limit; ` +
        'findings outside it could not be deduped. Raise CODE_REVIEW_EXISTING_ISSUES_LIMIT.',
    );
  }
  const issues = [];
  for (const issue of all) {
    const title = issue.title || '';
    const titlePrefix = titlePrefixes.find((prefix) => title.startsWith(prefix));
    if (!titlePrefix) continue;
    const fpMatch = (issue.body || '').match(/code-review-fingerprint:\s*([a-f0-9]+)/);
    issues.push({
      number: issue.number,
      title: title.slice(titlePrefix.length).trim(),
      summary: extractWhat(issue.body || ''),
      state: String(issue.state || '').toLowerCase(),
      stateReason: String(issue.stateReason || '').toLowerCase(),
      closedAt: issue.closedAt || null,
      fingerprint: fpMatch ? fpMatch[1] : null,
    });
  }
  return issues;
}

// Pull the "## What" paragraph out of an issue body for a compact dedupe signal.
function extractWhat(body) {
  const m = body.match(/##\s*What\s*\n+([\s\S]*?)(?:\n##\s|\n---|\n<!--|$)/);
  return (m ? m[1] : body).replace(/\s+/g, ' ').trim().slice(0, 400);
}

// Ask the model which NEW findings are the SAME underlying problem as an EXISTING tracked issue for
// this slice. Matches on substance, not wording (the issue text is regenerated each run). Returns an
// array aligned to `newFindings`: the matched existing issue number, or null for a genuinely new one.
async function judgeDuplicates(slice, newFindings, existingIssues) {
  if (newFindings.length === 0 || existingIssues.length === 0) {
    return newFindings.map(() => null);
  }
  const validNumbers = new Set(existingIssues.map((e) => e.number));
  const system = [
    'You decide whether each NEW code-review finding describes the SAME underlying problem as one of',
    'the EXISTING tracked issues for this module. Match on the SUBSTANCE of the problem (same code,',
    'same defect or concern) — the wording is rewritten every run, so identical wording is not',
    'required, and different wording does not make it a different problem. Be conservative: only match',
    'when you are confident it is the same concern. Two different problems in the same file are NOT a',
    'match. Return only the JSON described; no prose.',
  ].join('\n');
  const existingBlock = existingIssues
    .map((e) => `#${e.number} [${e.state}${e.stateReason ? '/' + e.stateReason : ''}]: ${e.title}\n    ${e.summary}`)
    .join('\n');
  const newBlock = newFindings
    .map((f, i) => `N${i}: ${f.title}\n    ${(f.summary || '').replace(/\s+/g, ' ').slice(0, 400)}\n    files: ${(f.files || []).join(', ')}`)
    .join('\n');
  const user = [
    `Module: ${slice.name}`,
    '',
    'EXISTING tracked issues (open and closed):',
    existingBlock,
    '',
    `NEW findings from this run (N0..N${newFindings.length - 1}):`,
    newBlock,
    '',
    `Return ONLY a JSON array of exactly ${newFindings.length} objects, one per NEW finding in order:`,
    '  { "match": <existing issue number> | null }',
    'Use the issue number of the existing issue it duplicates, or null if it is genuinely new.',
  ].join('\n');

  try {
    const text = await anthropicMessage(system, user, 2000);
    const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/i);
    const arr = JSON.parse((fenced ? fenced[1] : text).trim());
    if (!Array.isArray(arr)) throw new Error('not an array');
    return newFindings.map((_, i) => {
      const m = arr[i] && typeof arr[i].match === 'number' ? arr[i].match : null;
      // Ignore a number the model invented that isn't a real existing issue — safer to file a new
      // issue than to silently suppress a finding against a non-existent match.
      return m !== null && validNumbers.has(m) ? m : null;
    });
  } catch (error) {
    console.log(`reviewCodebaseSlice: dedupe judge unavailable (${error?.message || error}); using exact fingerprint only.`);
    return newFindings.map(() => null);
  }
}

function daysSince(iso) {
  if (!iso) return Infinity;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / 86_400_000;
}

// Re-surface a finding that recurs after its issue was closed: reopen it, add the given marker label,
// and leave one comment explaining why. Used for both regressions (closed via a fix) and revisits
// (a won't-fix whose suppression window has lapsed). No new issue is created, so the issue list does
// not grow on recurrence — the history stays on the one original issue.
function resurfaceIssue(number, label, comment) {
  try {
    gh(['issue', 'reopen', String(number), '--repo', REPO]);
    gh(['issue', 'edit', String(number), '--repo', REPO, '--add-label', label]);
    gh(['issue', 'comment', String(number), '--repo', REPO, '--body', comment]);
    return true;
  } catch (error) {
    console.log(`reviewCodebaseSlice: could not resurface #${number}: ${error?.message || error}`);
    return false;
  }
}

function buildIssueBody(slice, finding, fp) {
  const files = Array.isArray(finding.files) && finding.files.length
    ? finding.files.map((f) => `\`${f}\``).join(', ')
    : '(not specified)';
  return [
    `<!-- code-review-fingerprint: ${fp} -->`,
    `Automated code review of the ${slice.type} \`${slice.name}\` (${slice.paths.length} folder(s)).`,
    '',
    `**Severity:** ${finding.severity || 'unknown'}`,
    `**Category:** ${finding.category || 'unknown'}`,
    `**Files:** ${files}`,
    '',
    '## What',
    '',
    finding.summary || '(no summary)',
    '',
    '## Suggested fix',
    '',
    finding.recommendation || '(no recommendation)',
    '',
    '---',
    'Filed by the scheduled code-review sweep (`.github/workflows/code-review-sweep.yml`).',
    'When labeled `code-review:actionable`, the implement workflow',
    '(`.github/workflows/code-review-implement.yml`) can open a pull request for it. Remove',
    'that label to keep this as a tracking note only.',
    '',
    'Closing this issue is durable — the sweep dedupes against closed issues too, so it will not be',
    're-filed as a new issue. Close as **not planned** to dismiss it (the sweep may re-surface it for',
    `a fresh look after ${WONTFIX_REVISIT_DAYS} days, tagged \`code-review:revisit\`, since the code may have`,
    'changed by then). If it is closed as **completed**/fixed and the same finding recurs later, the',
    'sweep reopens this issue tagged `code-review:regression` rather than opening a duplicate.',
  ].join('\n');
}

function fileIssue(slice, finding, fp) {
  const title = `Code review (${slice.name}): ${finding.title}`;
  const labels = ['code-review'];
  if (finding.actionable === true) {
    labels.push('code-review:actionable');
  }
  const args = ['issue', 'create', '--repo', REPO, '--title', title, '--body', buildIssueBody(slice, finding, fp)];
  for (const label of labels) {
    args.push('--label', label);
  }
  return gh(args).trim();
}

// File up to MAX_ISSUES findings (highest severity first). Returns the count filed and the findings
// the cap left unattempted, which the caller keeps on the ledger row for the next run.
async function fileFindings(slice, findings, sliceIssues) {
  ensureLabel('code-review', '5319e7', 'Filed by the scheduled code-review sweep');
  ensureLabel('code-review:actionable', '0e8a16', 'Code-review finding with a small, safe fix; eligible for an auto PR');
  ensureLabel('code-review:regression', 'b60205', 'A previously-fixed code-review finding the sweep saw recur');
  ensureLabel('code-review:revisit', 'fbca04', 'A dismissed (won\'t-fix) code-review finding the sweep re-surfaced for a fresh decision');

  // Match new findings to existing slice issues by SUBSTANCE (the model), not by title text. The
  // embedded fingerprint is a free exact-match fast path for the rare run where the title is identical.
  const issuesByNumber = new Map(sliceIssues.map((i) => [i.number, i]));
  const fingerprintToIssue = new Map();
  for (const i of sliceIssues) {
    if (i.fingerprint && !fingerprintToIssue.has(i.fingerprint)) fingerprintToIssue.set(i.fingerprint, i);
  }
  const judged = await judgeDuplicates(slice, findings, sliceIssues);

  let filed = 0;
  let idx = 0;
  for (; idx < findings.length; idx += 1) {
    const finding = findings[idx];
    if (filed >= MAX_ISSUES) {
      break;
    }
    if (!finding.title) {
      continue;
    }
    const fp = fingerprint(slice.name, finding.title);
    // Prefer the semantic match; fall back to an exact fingerprint match.
    const matchNumber = judged[idx] ?? fingerprintToIssue.get(fp)?.number ?? null;
    const prior = matchNumber !== null ? issuesByNumber.get(matchNumber) : undefined;

    if (prior && prior.state === 'open') {
      // Already tracked on an open issue — nothing to do.
      console.log(`reviewCodebaseSlice: skip duplicate of open #${prior.number} "${finding.title}".`);
      continue;
    }

    if (prior && prior.state === 'closed') {
      if (prior.stateReason === 'completed') {
        // Closed via a fix but the finding is back — a regression. Reopen the original, don't duplicate.
        if (resurfaceIssue(prior.number, 'code-review:regression',
          `The code-review sweep flagged this again after it was closed as fixed — possible regression.\n\n**${finding.title}**\n\n${finding.summary || ''}`)) {
          filed += 1;
          console.log(`reviewCodebaseSlice: regression — reopened #${prior.number} "${finding.title}".`);
        }
        continue;
      }
      // Closed as "not planned" (or closed with no reason): a dismissal. Suppress within the window;
      // after it lapses, re-surface once for a fresh decision against possibly-changed code.
      const age = daysSince(prior.closedAt);
      if (WONTFIX_REVISIT_DAYS <= 0 || age <= WONTFIX_REVISIT_DAYS) {
        console.log(`reviewCodebaseSlice: skip dismissed #${prior.number} "${finding.title}" (closed ${Math.round(age)}d ago).`);
        continue;
      }
      if (resurfaceIssue(prior.number, 'code-review:revisit',
        `This was dismissed (closed as not planned) ${Math.round(age)} days ago. The code-review sweep raised it again; since the code may have changed, please re-decide whether it still applies.\n\n**${finding.title}**\n\n${finding.summary || ''}`)) {
        filed += 1;
        console.log(`reviewCodebaseSlice: revisit — reopened #${prior.number} "${finding.title}".`);
      }
      continue;
    }

    // Genuinely new finding — unless an identical-titled one was already filed earlier this run.
    if (fingerprintToIssue.has(fp)) {
      console.log(`reviewCodebaseSlice: skip same-run duplicate "${finding.title}".`);
      continue;
    }
    const url = fileIssue(slice, finding, fp);
    fingerprintToIssue.set(fp, { number: 0, state: 'open' });
    filed += 1;
    console.log(`reviewCodebaseSlice: filed ${url}`);
  }

  const deferred = findings.slice(idx).filter((f) => f && f.title).map(compactFinding);
  if (deferred.length > 0) {
    console.log(`reviewCodebaseSlice: hit MAX_ISSUES (${MAX_ISSUES}); ${deferred.length} finding(s) carry over to the next run of ${slice.name}.`);
  }
  return { filed, deferred };
}

// ---------------------------------------------------------------------------------------------
// Modes.

function requireReviewEnv() {
  const missing = [];
  if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
  if (!process.env.GH_TOKEN && !DRY_RUN) missing.push('GH_TOKEN');
  if (missing.length > 0) {
    // Exiting 0 here used to make a lost secret look like a successful sweep, and the test-script
    // refresh after it still ran. A missing secret is a failed run.
    throw new Error(`${missing.join(' and ')} not set; the review cannot run. Check the Infisical secret injection and the workflow env.`);
  }
}

function logDiscovery(discovery, reconciled) {
  if (reconciled.added.length) {
    note(`reviewCodebaseSlice: new slice(s) added to the ledger as never reviewed: ${reconciled.added.join(', ')}.`);
  }
  if (reconciled.pruned.length) {
    note(`reviewCodebaseSlice: slice(s) whose folders are gone, dropped from the ledger: ${reconciled.pruned.join(', ')}.`);
  }
  for (const { rel, reason } of discovery.excluded) {
    note(`reviewCodebaseSlice: not reviewed: ${rel} (${reason}).`);
  }
}

function loadAndReconcile() {
  const discovery = discoverSlices();
  const reconciled = reconcileSlices(loadLedger(), discovery.slices);
  logDiscovery(discovery, reconciled);
  return { discovery, ledger: reconciled.ledger, reconciled };
}

function sliceBytes(files) {
  let total = 0;
  for (const f of files) {
    try {
      total += statSync(f.abs).size;
    } catch {
      // no-trace: a file that vanished between discovery and sizing contributes nothing.
    }
  }
  return total;
}

function runPick() {
  const asJson = MODE_ARGS.includes('--json');
  const { discovery, ledger, reconciled } = loadAndReconcile();
  const { row, reason } = pickSlice(ledger, discovery.slices);
  if (!row) {
    console.log('reviewCodebaseSlice: nothing to review.');
    return;
  }
  const slice = discovery.slices.get(row.name);
  const bytes = sliceBytes(slice.files);
  const start = resumeIndex(row, slice.files);
  const neverReviewed = ledger.slices.filter((s) => !s.lastReviewedAt).map((s) => s.name);
  const report = {
    slice: row.name,
    type: slice.type,
    reason,
    folders: slice.paths,
    note: slice.note || undefined,
    fileCount: slice.files.length,
    bytes,
    runsAtBudget: Math.max(1, Math.ceil(bytes / MAX_BYTES)),
    resumeAt: row.partial ? { index: start, file: slice.files[start]?.rel || null } : null,
    deferredFindings: Array.isArray(row.deferred) ? row.deferred : [],
    contracts: gatherContracts(row.name).files,
    lastReviewedAt: row.lastReviewedAt,
    ledger: { path: ledgerPath, mergedWith: ledgerMergePaths },
    newSlices: reconciled.added,
    prunedSlices: reconciled.pruned,
    neverReviewed,
    excluded: discovery.excluded,
    files: slice.files.map((f) => f.rel),
  };
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const lines = [
    `Slice: ${report.slice} (${report.type}) — ${report.reason}`,
    'Folders:',
    ...report.folders.map((p) => `  - ${p}`),
    ...(report.note ? [`  ${report.note}`] : []),
    `Files: ${report.fileCount} (${Math.round(bytes / 1024)} KB; ${report.runsAtBudget} scheduled run(s) at the ${MAX_BYTES}-byte budget — by hand, review all of it)`,
    ...(report.resumeAt ? [`Resume at: file ${report.resumeAt.index + 1} (${report.resumeAt.file})`] : []),
    `Last reviewed: ${report.lastReviewedAt || 'never'}`,
    `Contracts: ${report.contracts.length ? report.contracts.join(', ') : 'none'}`,
    `Ledger: ${report.ledger.path}${report.ledger.mergedWith.length ? ` merged with ${report.ledger.mergedWith.join(', ')}` : ' (no other copy merged — set CODE_REVIEW_LEDGER_MERGE_PATHS to the branch copy)'}`,
    ...(report.deferredFindings.length
      ? [`Leftover findings from the last run (${report.deferredFindings.length}) — file these first:`, JSON.stringify(report.deferredFindings, null, 2)]
      : []),
    `Never reviewed (${neverReviewed.length}): ${neverReviewed.join(', ') || 'none'}`,
    ...(report.newSlices.length ? [`New since the ledger was written: ${report.newSlices.join(', ')}`] : []),
    ...(report.prunedSlices.length ? [`Gone since the ledger was written: ${report.prunedSlices.join(', ')}`] : []),
    'Files in this slice:',
    ...report.files.map((f) => `  ${f}`),
  ];
  console.log(lines.join('\n'));
}

function runStamp() {
  const name = MODE_ARGS.find((a) => !a.startsWith('--'));
  if (!name) {
    throw new Error('--stamp needs the slice name: --stamp <slice> [--issues N]');
  }
  const issuesIdx = MODE_ARGS.indexOf('--issues');
  const issues = issuesIdx !== -1 ? Number(MODE_ARGS[issuesIdx + 1]) : 0;
  if (!Number.isFinite(issues) || issues < 0) {
    throw new Error('--issues must be a non-negative number.');
  }
  const { discovery, ledger } = loadAndReconcile();
  const wanted = name.trim().toLowerCase();
  const row = ledger.slices.find((s) => s.name.toLowerCase() === wanted);
  if (!row) {
    throw new Error(`Unknown slice '${name}'. Valid slices: ${[...discovery.slices.keys()].sort().join(', ')}`);
  }
  markComplete(row, issues);
  delete row.deferred;
  saveLedger(ledger);
  console.log(`reviewCodebaseSlice: stamped ${row.name} reviewed at ${row.lastReviewedAt} with ${issues} issue(s); ledger saved to ${ledgerPath}.`);
}

function runReconcile() {
  const { ledger, reconciled } = loadAndReconcile();
  saveLedger(ledger);
  console.log(
    `reviewCodebaseSlice: ledger reconciled and saved to ${ledgerPath} (${ledger.slices.length} slices; ` +
      `${reconciled.added.length} added, ${reconciled.pruned.length} pruned).`,
  );
}

function runFingerprint() {
  const [slice, ...titleParts] = MODE_ARGS;
  const title = titleParts.join(' ');
  if (!slice || !title) {
    throw new Error('--fingerprint needs the slice name and the finding title: --fingerprint <slice> <title>');
  }
  console.log(fingerprint(slice, title));
}

async function runReview() {
  requireReviewEnv();
  const { discovery, ledger } = loadAndReconcile();
  if (ledger.slices.length === 0) {
    console.log('reviewCodebaseSlice: no slices discovered under the configured roots.');
    return;
  }

  const { row, reason } = pickSlice(ledger, discovery.slices);
  if (!row) {
    console.log('reviewCodebaseSlice: nothing to review.');
    return;
  }
  const slice = discovery.slices.get(row.name);
  console.log(`reviewCodebaseSlice: picked ${slice.type} ${slice.name} — ${reason}.`);

  // Leftover findings from a capped run are filed before any new review of this slice, up to the
  // same cap. Nothing is sent to the model for review in such a run; the slice's stamp is unchanged.
  if (Array.isArray(row.deferred) && row.deferred.length > 0 && !row.partial) {
    if (DRY_RUN) {
      console.log(JSON.stringify({ slice: slice.name, leftoverFindings: row.deferred }, null, 2));
      return;
    }
    const sliceIssues = existingSliceIssues(slice.name);
    const { filed, deferred } = await fileFindings(slice, row.deferred, sliceIssues);
    row.lastRunIssues = filed;
    if (deferred.length > 0) row.deferred = deferred; else delete row.deferred;
    saveLedger(ledger);
    writeGithubOutput({ slice: slice.name, completed_slice: '', filed });
    console.log(`reviewCodebaseSlice: filed ${filed} leftover issue(s) for ${slice.name}; ${deferred.length} still to file.`);
    return;
  }

  const fileList = slice.files;
  if (fileList.length === 0) {
    console.log(`reviewCodebaseSlice: ${slice.name} has no source files; marking reviewed.`);
    markComplete(row, 0);
    if (!DRY_RUN) saveLedger(ledger);
    writeGithubOutput({ slice: slice.name, completed_slice: '', filed: 0 });
    return;
  }

  const start = resumeIndex(row, fileList);
  const chunk = gatherChunk(fileList, start, MAX_BYTES);
  const covered = `files ${chunk.startIdx + 1}–${chunk.endIdx} of ${fileList.length}`;
  const chunkNote = chunk.complete && start === 0
    ? `This run covers the entire slice (${fileList.length} file(s)).`
    : `This run covers ${covered}${chunk.complete ? ' (final part)' : ' — the rest continues next run'}.`;

  const contracts = gatherContracts(slice.name);
  const contractNote = contracts.files.length ? ` + ${contracts.files.length} contract file(s)` : '';
  // The code this slice calls from outside itself. Without it the reviewer reads call sites whose
  // implementations it cannot open and guesses at them, which is where its wrong findings come from.
  const deps = DEPS_MAX_BYTES > 0
    ? collectDependencyContext(fileList, { repoRoot, maxBytes: DEPS_MAX_BYTES })
    : { text: '', files: [], skipped: 0 };
  const depNote = deps.files.length
    ? ` + ${deps.files.length} imported file(s)${deps.skipped ? ` (${deps.skipped} dropped for budget)` : ''}`
    : '';
  // The findings already raised for this slice (open + closed). Passed to the reviewer so it doesn't
  // re-report a concern already tracked or already fixed (the main source of re-run churn), and reused
  // below for substance-based dedup. One fetch serves both. Fetched before the model call so a
  // GitHub failure costs nothing.
  const sliceIssues = DRY_RUN && !process.env.GH_TOKEN ? [] : existingSliceIssues(slice.name);
  console.log(`reviewCodebaseSlice: reviewing ${slice.type} ${slice.name} — ${covered}${contractNote}${depNote} with ${MODEL} (${sliceIssues.length} already-tracked).`);
  const findings = parseFindings(
    await askClaude(slice, chunk.text, chunkNote, contracts.text, sliceIssues, deps.text),
  );

  if (findings.length === 0) {
    console.log(`reviewCodebaseSlice: no findings for ${slice.name} (${covered}).`);
  }
  // Highest severity first, so the per-run cap keeps the issues that matter most.
  findings.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));

  if (DRY_RUN) {
    console.log(JSON.stringify({ slice: slice.name, covered, complete: chunk.complete, findings }, null, 2));
    return;
  }

  const { filed, deferred } = await fileFindings(slice, findings, sliceIssues);

  if (chunk.complete) {
    markComplete(row, filed);
    if (deferred.length > 0) row.deferred = deferred; else delete row.deferred;
    console.log(`reviewCodebaseSlice: completed ${slice.name}; filed ${filed} issue(s).`);
  } else {
    row.lastRunIssues = filed;
    row.cursor = chunk.nextCursor;
    row.nextFile = fileList[chunk.nextCursor].rel;
    row.partial = true;
    // A partial pass may also leave findings over; they are filed when the slice is next picked,
    // which — partial first — is the very next run.
    const carried = Array.isArray(row.deferred) ? row.deferred : [];
    if (carried.length + deferred.length > 0) row.deferred = [...carried, ...deferred]; else delete row.deferred;
    console.log(`reviewCodebaseSlice: ${slice.name} carries over from file ${chunk.nextCursor + 1} (${row.nextFile}); filed ${filed} issue(s).`);
  }
  saveLedger(ledger);
  writeGithubOutput({ slice: slice.name, completed_slice: chunk.complete ? slice.name : '', filed });
}

async function main() {
  switch (MODE) {
    case '--pick':
      return runPick();
    case '--stamp':
      return runStamp();
    case '--reconcile':
      return runReconcile();
    case '--fingerprint':
      return runFingerprint();
    case null:
      return runReview();
    default:
      throw new Error(`Unknown mode '${MODE}'. Modes: --pick, --stamp, --reconcile, --fingerprint, or none to review.`);
  }
}

main().catch((error) => {
  if (
    reportIfRunBlocked({
      script: 'reviewCodebaseSlice',
      error,
      manualRoute: '/rs',
      nothingLost: 'The ledger was not advanced, so the next run after this clears reviews the same slice.',
    })
  ) {
    process.exit(1);
  }
  console.error('reviewCodebaseSlice failed:', error?.message || error);
  process.exit(1);
});
