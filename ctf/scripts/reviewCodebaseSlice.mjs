#!/usr/bin/env node
// Review ONE plugin (or standalone module) of the codebase and file GitHub issues for the
// findings.
//
// This is the "code review" half of an incremental review pipeline that runs on a schedule
// (or by hand) instead of on every merge:
//
//   1. Discover slices by grouping folders by NAME across the source layers
//      (app/api, components, lib, mobile/src/features). A name that appears in several
//      layers is a plugin and is reviewed as ONE holistic slice (its API + server logic +
//      web UI + mobile feature together), so cross-layer bugs are visible. A name that
//      appears in only one layer is a standalone module (e.g. `auth`, `ui`, `chatbot`) and
//      is its own slice, so features outside any plugin still get reviewed.
//   2. Pick the slice to review: an in-progress (partial) slice first, then any
//      never-reviewed slice, then the least-recently-reviewed one. This guarantees every
//      slice gets at least one pass before any gets a second.
//   3. Send that slice's source to Claude (up to a per-run byte budget) and ask for
//      concrete, high-signal findings, including mismatches between the layers.
//   4. File one GitHub issue per finding, labelled `code-review`. Findings the model judges
//      to have a small, safe, self-contained fix also get `code-review:actionable`, which
//      the implement workflow can turn into a pull request.
//   5. Stamp the slice in the rotation ledger. A slice too big for one run carries over:
//      its remaining files are reviewed on the next run(s), and it is only marked fully
//      reviewed once every file has been covered (nothing is silently dropped).
//
// It never writes code or opens a PR. It no-ops safely when its environment is not
// configured, so it is harmless to schedule before the secrets are in place.
//
// Required environment:
//   ANTHROPIC_API_KEY    For the model call.
//   GH_TOKEN             A token with `issues: write` on the repo (the Actions token is fine).
//
// Optional environment:
//   GITHUB_REPOSITORY      owner/repo (default: chargingthefuture/chargingthefuture).
//   CODE_REVIEW_MODEL      Model id (default: claude-sonnet-4-6). Use a cheaper model to cut cost.
//   CODE_REVIEW_SLICE      Review this exact plugin/module name instead of the rotation pick.
//   CODE_REVIEW_MAX_ISSUES Most issues to file in one run (default: 8). Highest severity first.
//   CODE_REVIEW_MAX_BYTES  Per-run source byte budget (default: 200000 ≈ most whole plugins).
//   CODE_REVIEW_DRY_RUN    "1" to print findings without filing issues or touching the ledger.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const ledgerPath = join(repoRoot, 'ctf/config/code-review-ledger.json');

const REPO = (process.env.GITHUB_REPOSITORY || 'chargingthefuture/chargingthefuture').trim();
const MODEL = (process.env.CODE_REVIEW_MODEL || 'claude-sonnet-4-6').trim();
const FORCED_SLICE = (process.env.CODE_REVIEW_SLICE || '').trim();
const MAX_ISSUES = Number(process.env.CODE_REVIEW_MAX_ISSUES || '8');
const MAX_BYTES = Number(process.env.CODE_REVIEW_MAX_BYTES || '200000');
const DRY_RUN = process.env.CODE_REVIEW_DRY_RUN === '1';

// Folders with the same name under these layers are grouped into one slice. A name in two
// or more layers is treated as a plugin; a name in one layer is a standalone module.
const SLICE_ROOTS = [
  'ctf/packages/web/app/api',
  'ctf/packages/web/components',
  'ctf/packages/web/lib',
  'ctf/packages/mobile/src/features',
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.sql'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '__snapshots__', '.turbo']);
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('reviewCodebaseSlice: ANTHROPIC_API_KEY not set; nothing to do.');
  process.exit(0);
}
if (!process.env.GH_TOKEN && !DRY_RUN) {
  console.log('reviewCodebaseSlice: GH_TOKEN not set; nothing to do.');
  process.exit(0);
}

function gh(args, options = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', ...options });
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// Group folders by name across the layers. Returns a Map of name -> { name, type, paths }.
function discoverSlices() {
  const byName = new Map();
  for (const root of SLICE_ROOTS) {
    const rootAbs = join(repoRoot, root);
    if (!isDir(rootAbs)) {
      continue;
    }
    for (const name of readdirSync(rootAbs)) {
      if (SKIP_DIRS.has(name) || name.startsWith('.')) {
        continue;
      }
      if (!isDir(join(rootAbs, name))) {
        continue;
      }
      if (!byName.has(name)) {
        byName.set(name, { name, type: 'module', paths: [] });
      }
      byName.get(name).paths.push(`${root}/${name}`);
    }
  }
  for (const slice of byName.values()) {
    slice.paths.sort();
    slice.type = slice.paths.length >= 2 ? 'plugin' : 'module';
  }
  return byName;
}

function loadLedger() {
  try {
    const parsed = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    if (!Array.isArray(parsed.slices)) {
      parsed.slices = [];
    }
    return parsed;
  } catch {
    return { slices: [] };
  }
}

function saveLedger(ledger) {
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

// Keep rotation state for every discovered slice; drop slices whose folders are all gone.
// `cursor` is the index into the slice's file list where the next run resumes; `partial`
// means a run covered only part of the slice and it must be continued.
function reconcileSlices(ledger, discovered) {
  const known = new Map(ledger.slices.map((s) => [s.name, s]));
  const result = [];
  for (const name of [...discovered.keys()].sort()) {
    const existing = known.get(name);
    if (existing) {
      existing.type = discovered.get(name).type;
      if (typeof existing.cursor !== 'number') existing.cursor = 0;
      if (typeof existing.partial !== 'boolean') existing.partial = false;
      result.push(existing);
    } else {
      result.push({ name, type: discovered.get(name).type, lastReviewedAt: null, lastRunIssues: 0, cursor: 0, partial: false });
    }
  }
  ledger.slices = result;
  return ledger;
}

// In-progress (partial) slice first, then never-reviewed, then least-recently-reviewed.
function pickSlice(ledger) {
  if (FORCED_SLICE) {
    return (
      ledger.slices.find((s) => s.name === FORCED_SLICE) || {
        name: FORCED_SLICE,
        type: 'module',
        lastReviewedAt: null,
        lastRunIssues: 0,
        cursor: 0,
        partial: false,
      }
    );
  }
  const partial = ledger.slices.find((s) => s.partial);
  if (partial) {
    return partial;
  }
  const sorted = [...ledger.slices].sort((a, b) => {
    if (!a.lastReviewedAt) return -1;
    if (!b.lastReviewedAt) return 1;
    return new Date(a.lastReviewedAt) - new Date(b.lastReviewedAt);
  });
  return sorted[0] || null;
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

// Deterministic, repo-relative file list across all of a slice's folders.
function buildFileList(paths) {
  const files = [];
  for (const rel of paths) {
    const abs = join(repoRoot, rel);
    if (isDir(abs)) {
      walkSourceFiles(abs, files);
    }
  }
  return files
    .map((abs) => ({ abs, rel: relative(repoRoot, abs) }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

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

async function askClaude(slice, source, chunkNote) {
  const layers = slice.paths.join('\n  ');
  const system = [
    'You are a senior engineer doing a code review of one plugin/module of "Charging the',
    'Future", an open-source Next.js + React Native app. Follow the repository rules in CLAUDE.md.',
    '',
    'You are shown the whole slice across its layers at once. Look hard for bugs that live at',
    'the SEAMS between layers, not just within one file:',
    '  - the API route returns one shape but the web component or mobile screen expects another;',
    "  - a lib/server function's contract changed but a caller still uses the old shape;",
    '  - an auth, permission, or input-validation check present on one path but missing on another;',
    '  - web and mobile implementing the same feature differently (parity drift).',
    'Also report within-file problems: real bugs, security/correctness issues, missing error',
    'handling, clear dead code, obvious simplifications, and TypeScript type-safety violations',
    '(no `any` without an eslint-disable + reason).',
    '',
    'Do NOT report pure style or formatting nits, and do not invent problems. If the slice looks',
    'fine, return []. Write every field in plain language. Be specific and brief.',
  ].join('\n');

  const user = [
    `Review the ${slice.type} \`${slice.name}\`. It spans these folders:`,
    `  ${layers}`,
    chunkNote,
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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }
  const result = await response.json();
  return result.content[0].text.trim();
}

function parseFindings(raw) {
  const fenced = raw.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/i);
  const text = fenced ? fenced[1].trim() : raw;
  const findings = JSON.parse(text);
  if (!Array.isArray(findings)) {
    throw new Error('Model did not return a JSON array.');
  }
  return findings;
}

function fingerprint(sliceName, title) {
  return createHash('sha1').update(`${sliceName}\n${title}`).digest('hex').slice(0, 16);
}

function ensureLabel(name, color, description) {
  try {
    gh(['label', 'create', name, '--repo', REPO, '--color', color, '--description', description, '--force']);
  } catch {
    // Best-effort; applying the label at create time is what matters.
  }
}

// Fingerprints already on open `code-review` issues, so reruns don't refile the same thing.
function existingFingerprints() {
  try {
    const raw = gh([
      'issue', 'list', '--repo', REPO, '--label', 'code-review', '--state', 'open',
      '--json', 'body', '--limit', '300',
    ]);
    const set = new Set();
    for (const issue of JSON.parse(raw)) {
      const match = (issue.body || '').match(/code-review-fingerprint:\s*([a-f0-9]+)/);
      if (match) {
        set.add(match[1]);
      }
    }
    return set;
  } catch {
    return new Set();
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
    'When labelled `code-review:actionable`, the implement workflow',
    '(`.github/workflows/code-review-implement.yml`) can open a pull request for it. Remove',
    'that label to keep this as a tracking note only.',
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

async function main() {
  const discovered = discoverSlices();
  const ledger = reconcileSlices(loadLedger(), discovered);
  if (ledger.slices.length === 0) {
    console.log('reviewCodebaseSlice: no slices discovered under the configured roots.');
    return;
  }

  const slice = pickSlice(ledger);
  if (!slice) {
    console.log('reviewCodebaseSlice: nothing to review.');
    return;
  }
  // pickSlice may synthesize a forced slice that is not in `discovered`; fill its folders.
  slice.paths = (discovered.get(slice.name) || { paths: [] }).paths;

  const fileList = buildFileList(slice.paths);
  if (fileList.length === 0) {
    console.log(`reviewCodebaseSlice: ${slice.name} has no source files; marking reviewed.`);
    slice.lastReviewedAt = new Date().toISOString();
    slice.lastRunIssues = 0;
    slice.cursor = 0;
    slice.partial = false;
    if (!DRY_RUN) saveLedger(ledger);
    return;
  }

  const start = typeof slice.cursor === 'number' && slice.cursor < fileList.length ? slice.cursor : 0;
  const chunk = gatherChunk(fileList, start, MAX_BYTES);
  const covered = `files ${chunk.startIdx + 1}–${chunk.endIdx} of ${fileList.length}`;
  const chunkNote = chunk.complete && start === 0
    ? `This run covers the whole slice (${fileList.length} file(s)).`
    : `This run covers ${covered}${chunk.complete ? ' (final part)' : ' — the rest continues next run'}.`;

  console.log(`reviewCodebaseSlice: reviewing ${slice.type} ${slice.name} — ${covered} with ${MODEL}.`);
  const findings = parseFindings(await askClaude(slice, chunk.text, chunkNote));

  if (findings.length === 0) {
    console.log(`reviewCodebaseSlice: no findings for ${slice.name} (${covered}).`);
  }
  // Highest severity first, so the per-run cap keeps the issues that matter most.
  findings.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));

  if (DRY_RUN) {
    console.log(JSON.stringify({ slice: slice.name, covered, complete: chunk.complete, findings }, null, 2));
    return;
  }

  ensureLabel('code-review', '5319e7', 'Filed by the scheduled code-review sweep');
  ensureLabel('code-review:actionable', '0e8a16', 'Code-review finding with a small, safe fix; eligible for an auto PR');

  const seen = existingFingerprints();
  let filed = 0;
  for (const finding of findings) {
    if (filed >= MAX_ISSUES) {
      console.log(`reviewCodebaseSlice: hit MAX_ISSUES (${MAX_ISSUES}); remaining findings deferred.`);
      break;
    }
    if (!finding.title) {
      continue;
    }
    const fp = fingerprint(slice.name, finding.title);
    if (seen.has(fp)) {
      console.log(`reviewCodebaseSlice: skip duplicate "${finding.title}".`);
      continue;
    }
    const url = fileIssue(slice, finding, fp);
    seen.add(fp);
    filed += 1;
    console.log(`reviewCodebaseSlice: filed ${url}`);
  }

  slice.lastRunIssues = filed;
  if (chunk.complete) {
    slice.lastReviewedAt = new Date().toISOString();
    slice.cursor = 0;
    slice.partial = false;
    console.log(`reviewCodebaseSlice: completed ${slice.name}; filed ${filed} issue(s).`);
  } else {
    slice.cursor = chunk.nextCursor;
    slice.partial = true;
    console.log(`reviewCodebaseSlice: ${slice.name} carries over from file ${chunk.nextCursor + 1}; filed ${filed} issue(s).`);
  }
  saveLedger(ledger);
}

main().catch((error) => {
  console.error('reviewCodebaseSlice failed:', error?.message || error);
  process.exit(1);
});
