#!/usr/bin/env node
// Review ONE slice of the codebase and file GitHub issues for the findings.
//
// This is the "code review" half of an incremental review pipeline that runs on a
// schedule (or by hand) instead of on every merge:
//
//   1. Discover candidate slices (immediate subdirectories of a few source roots).
//   2. Pick the least-recently-reviewed slice, using the rotation ledger at
//      ctf/config/code-review-ledger.json (new slices are reviewed first).
//   3. Send that slice's source to Claude and ask for concrete, high-signal findings.
//   4. File one GitHub issue per finding, labelled `code-review`. Findings the model
//      judges to have a small, safe, self-contained fix also get `code-review:actionable`,
//      which the implement workflow can turn into a pull request.
//   5. Stamp the slice as reviewed in the ledger so the next run moves on.
//
// It never writes code or opens a PR. It is deliberately bounded (one slice per run, a
// cap on issues filed, a byte cap on the source sent) so a single run costs little. It
// no-ops safely when its environment is not configured, so it is harmless to schedule
// before the secrets are in place.
//
// Required environment:
//   ANTHROPIC_API_KEY    For the model call.
//   GH_TOKEN             A token with `issues: write` on the repo (the Actions token is fine).
//
// Optional environment:
//   GITHUB_REPOSITORY      owner/repo (default: chargingthefuture/chargingthefuture).
//   CODE_REVIEW_MODEL      Model id (default: claude-sonnet-4-6). Use a cheaper model to cut cost.
//   CODE_REVIEW_SLICE      Review this exact slice path instead of the rotation pick.
//   CODE_REVIEW_MAX_ISSUES Most issues to file in one run (default: 6). Highest severity first.
//   CODE_REVIEW_MAX_BYTES  Most source bytes to send to the model (default: 60000).
//   CODE_REVIEW_DRY_RUN    "1" to print findings without filing issues or touching the ledger.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const ledgerPath = join(repoRoot, 'ctf/config/code-review-ledger.json');

const REPO = (process.env.GITHUB_REPOSITORY || 'chargingthefuture/chargingthefuture').trim();
const MODEL = (process.env.CODE_REVIEW_MODEL || 'claude-sonnet-4-6').trim();
const FORCED_SLICE = (process.env.CODE_REVIEW_SLICE || '').trim();
const MAX_ISSUES = Number(process.env.CODE_REVIEW_MAX_ISSUES || '6');
const MAX_BYTES = Number(process.env.CODE_REVIEW_MAX_BYTES || '60000');
const DRY_RUN = process.env.CODE_REVIEW_DRY_RUN === '1';

// Immediate subdirectories of these roots become the slices we rotate through.
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

// Immediate subdirectories of the configured roots, as repo-relative paths.
function discoverSlices() {
  const slices = [];
  for (const root of SLICE_ROOTS) {
    const rootAbs = join(repoRoot, root);
    if (!isDir(rootAbs)) {
      continue;
    }
    for (const name of readdirSync(rootAbs)) {
      if (SKIP_DIRS.has(name) || name.startsWith('.')) {
        continue;
      }
      if (isDir(join(rootAbs, name))) {
        slices.push(`${root}/${name}`);
      }
    }
  }
  return slices.sort();
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

// Add newly discovered slices, drop ones whose directory is gone.
function reconcileSlices(ledger, discovered) {
  const known = new Map(ledger.slices.map((s) => [s.path, s]));
  const result = [];
  for (const path of discovered) {
    result.push(known.get(path) || { path, lastReviewedAt: null, lastRunIssues: 0 });
  }
  ledger.slices = result;
  return ledger;
}

// Least-recently-reviewed first; never-reviewed (null) beats any timestamp.
function pickSlice(ledger) {
  if (FORCED_SLICE) {
    return (
      ledger.slices.find((s) => s.path === FORCED_SLICE) || {
        path: FORCED_SLICE,
        lastReviewedAt: null,
        lastRunIssues: 0,
      }
    );
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

// Concatenate the slice's source up to the byte cap, with a header per file. Returns the
// text plus the count of files included, so the model sees real code, not a guess.
function gatherSliceSource(slicePath) {
  const sliceAbs = join(repoRoot, slicePath);
  if (!isDir(sliceAbs)) {
    return { text: '', fileCount: 0, truncated: false };
  }
  const files = walkSourceFiles(sliceAbs, []).sort();
  let text = '';
  let fileCount = 0;
  let truncated = false;
  for (const fileAbs of files) {
    if (text.length >= MAX_BYTES) {
      truncated = true;
      break;
    }
    const rel = relative(repoRoot, fileAbs);
    const header = `\n===== FILE: ${rel} =====\n`;
    const remaining = MAX_BYTES - text.length - header.length;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    let body = readFileSync(fileAbs, 'utf8');
    if (body.length > remaining) {
      body = `${body.slice(0, remaining)}\n... (file truncated) ...`;
      truncated = true;
    }
    text += header + body;
    fileCount += 1;
  }
  return { text, fileCount, truncated };
}

async function askClaude(slicePath, source) {
  const system = [
    'You are a senior engineer doing a code review of one slice of "Charging the Future",',
    'an open-source Next.js + React Native app. Follow the repository rules in CLAUDE.md.',
    '',
    'Report only concrete, high-signal findings: real bugs, security or correctness problems,',
    'missing error handling, clear dead code, obvious simplifications, and TypeScript',
    'type-safety violations (no `any` without an eslint-disable + reason). Do NOT report pure',
    'style or formatting nits, and do not invent problems. If the slice looks fine, return [].',
    '',
    'Write every field in plain language. No jargon. Be specific and brief.',
  ].join('\n');

  const user = [
    `Review the slice \`${slicePath}\`. The source files follow, each after a "===== FILE: <path> =====" header.`,
    'Some long files may be truncated; do not flag truncation itself as a problem.',
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

function fingerprint(slicePath, title) {
  return createHash('sha1').update(`${slicePath}\n${title}`).digest('hex').slice(0, 16);
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

function buildIssueBody(slicePath, finding, fp) {
  const files = Array.isArray(finding.files) && finding.files.length
    ? finding.files.map((f) => `\`${f}\``).join(', ')
    : '(not specified)';
  return [
    `<!-- code-review-fingerprint: ${fp} -->`,
    `Automated code review of \`${slicePath}\`.`,
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

function fileIssue(slicePath, finding, fp) {
  const base = slicePath.split('/').pop();
  const title = `Code review (${base}): ${finding.title}`;
  const labels = ['code-review'];
  if (finding.actionable === true) {
    labels.push('code-review:actionable');
  }
  const args = ['issue', 'create', '--repo', REPO, '--title', title, '--body', buildIssueBody(slicePath, finding, fp)];
  for (const label of labels) {
    args.push('--label', label);
  }
  return gh(args).trim();
}

async function main() {
  const ledger = reconcileSlices(loadLedger(), discoverSlices());
  if (ledger.slices.length === 0) {
    console.log('reviewCodebaseSlice: no slices discovered under the configured roots.');
    return;
  }

  const slice = pickSlice(ledger);
  if (!slice) {
    console.log('reviewCodebaseSlice: nothing to review.');
    return;
  }

  const { text, fileCount, truncated } = gatherSliceSource(slice.path);
  if (fileCount === 0) {
    console.log(`reviewCodebaseSlice: ${slice.path} has no source files; marking reviewed.`);
    slice.lastReviewedAt = new Date().toISOString();
    slice.lastRunIssues = 0;
    if (!DRY_RUN) saveLedger(ledger);
    return;
  }

  console.log(`reviewCodebaseSlice: reviewing ${slice.path} (${fileCount} file(s)${truncated ? ', truncated' : ''}) with ${MODEL}.`);
  const findings = parseFindings(await askClaude(slice.path, text));

  if (findings.length === 0) {
    console.log(`reviewCodebaseSlice: no findings for ${slice.path}.`);
  }

  // Highest severity first, so the per-run cap keeps the issues that matter most.
  findings.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));

  if (DRY_RUN) {
    console.log(JSON.stringify({ slice: slice.path, findings }, null, 2));
    return;
  }

  ensureLabel('code-review', '5319e7', 'Filed by the scheduled code-review sweep');
  ensureLabel('code-review:actionable', '0e8a16', 'Code-review finding with a small, safe fix; eligible for an auto PR');

  const seen = existingFingerprints();
  let filed = 0;
  for (const finding of findings) {
    if (filed >= MAX_ISSUES) {
      console.log(`reviewCodebaseSlice: hit MAX_ISSUES (${MAX_ISSUES}); remaining findings deferred to next sweep of this slice.`);
      break;
    }
    if (!finding.title) {
      continue;
    }
    const fp = fingerprint(slice.path, finding.title);
    if (seen.has(fp)) {
      console.log(`reviewCodebaseSlice: skip duplicate "${finding.title}".`);
      continue;
    }
    const url = fileIssue(slice.path, finding, fp);
    seen.add(fp);
    filed += 1;
    console.log(`reviewCodebaseSlice: filed ${url}`);
  }

  slice.lastReviewedAt = new Date().toISOString();
  slice.lastRunIssues = filed;
  saveLedger(ledger);
  console.log(`reviewCodebaseSlice: filed ${filed} issue(s) for ${slice.path}.`);
}

main().catch((error) => {
  console.error('reviewCodebaseSlice failed:', error?.message || error);
  process.exit(1);
});
