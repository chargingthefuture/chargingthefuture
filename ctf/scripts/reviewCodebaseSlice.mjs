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
//   3. Send that slice's source to Claude (up to a per-run byte budget), along with the
//      plugin's declared contracts as read-only reference, and ask for concrete, high-signal
//      findings — including mismatches between the layers and code that violates a contract.
//   4. File one GitHub issue per finding, labeled `code-review`. Findings the model judges
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
//   CODE_REVIEW_CONTRACTS_MAX_BYTES  Cap on contract reference bytes (default: 60000).
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
const CONTRACTS_MAX_BYTES = Number(process.env.CODE_REVIEW_CONTRACTS_MAX_BYTES || '60000');
// The model's findings JSON must fit in one response. 4000 was too small for a whole-plugin
// review: the JSON truncated mid-string and JSON.parse threw, failing the whole run. Give it ample
// room (Sonnet allows far more), overridable for cost tuning.
const MAX_OUTPUT_TOKENS = Number(process.env.CODE_REVIEW_MAX_OUTPUT_TOKENS || '16000');
const DRY_RUN = process.env.CODE_REVIEW_DRY_RUN === '1';
// How long a won't-fix (closed as "not planned") finding stays suppressed before a recurrence is
// re-surfaced for a fresh decision. Dedup keys off the finding TITLE, not the code, so a dismissal is
// "not now", not "never": after this window the code may have changed and the call may differ. A
// finding that was closed via a fix (completed) has no window — if it recurs it is a regression and is
// re-surfaced immediately. 0 disables the window (won't-fix suppressed forever).
const WONTFIX_REVISIT_DAYS = Number(process.env.CODE_REVIEW_WONTFIX_DAYS || '90');

// A plugin's declared contracts are sent as read-only reference so the reviewer can check
// the code against them. Looked up by exact filename (prefix = SLICE_NAME upper-snake);
// modules without contracts simply get none. Sent on every run for the slice, separate from
// the code byte budget, and capped so they don't crowd out the code.
const CONTRACTS_DIR = 'ctf/docs/contracts';
const CONTRACT_SUFFIXES = [
  '_PLUGIN_COMMAND_CONTRACTS.yaml',
  '_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml',
  '_PLUGIN_AUDIT_CONTRACTS.yaml',
  '_PROFILE_AND_DELETION_CONTRACT.md',
];

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
// `discovered` is the map of slice name -> { name, type, paths } from discoverSlices(); it is
// used to resolve a forced slice tolerantly and to fail loudly on an unknown one.
function pickSlice(ledger, discovered) {
  if (FORCED_SLICE) {
    // Resolve the forced name tolerantly: trim + lowercase both sides so `Workforce`,
    // `workforce`, and ` workforce ` all match the `workforce` slice (slice/folder names are
    // already lowercase, so lowercasing the comparison is safe). Match against the DISCOVERED
    // slice names, then return that name's reconciled ledger row.
    const wanted = FORCED_SLICE.toLowerCase();
    const resolvedName = [...discovered.keys()].find((name) => name.trim().toLowerCase() === wanted);
    if (!resolvedName) {
      // A forced slice that matches no discovered folder used to fall through to a no-op review
      // of nothing. Fail loudly instead, before any model call or ledger write.
      const valid = [...discovered.keys()].sort().join(', ');
      console.error(`reviewCodebaseSlice: Unknown slice '${FORCED_SLICE}'. Valid slices: ${valid}`);
      process.exit(1);
    }
    return (
      ledger.slices.find((s) => s.name === resolvedName) || {
        name: resolvedName,
        type: discovered.get(resolvedName).type,
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

// A plugin's declared contracts (by exact filename), as read-only reference text.
function gatherContracts(sliceName) {
  const prefix = sliceName.toUpperCase().replace(/-/g, '_');
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
      continue; // this contract does not exist for this slice
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
  } catch {
    return fallback;
  }
}

async function askClaude(slice, source, chunkNote, contractsText, existingFindings = []) {
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
    chunkNote,
    ...(contractsText
      ? [
          '',
          'DECLARED CONTRACTS for this plugin (reference — the source of truth for what it may do; not under review):',
          contractsText,
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

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }
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
    // fail the whole run. Salvage the complete finding objects parsed before the break instead of
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
          // An individually malformed object is skipped, not fatal.
        }
        objStart = -1;
      }
    }
  }
  return objects;
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

// Every `code-review` issue this sweep has ever filed for THIS slice, open OR closed. Reading closed
// issues too is what makes "close it" a durable decision (a dismissed/fixed finding is matched, not
// re-filed). We match on substance via the model (judgeDuplicates), not on the issue title — an LLM
// rewrites the title every run, so a text fingerprint would miss a reworded re-flag. The embedded
// fingerprint is kept only as a cheap exact-match fast path.
function existingSliceIssues(sliceName) {
  const titlePrefix = `Code review (${sliceName}):`;
  try {
    const raw = gh([
      'issue', 'list', '--repo', REPO, '--label', 'code-review', '--state', 'all',
      '--json', 'number,title,state,stateReason,closedAt,body', '--limit', '500',
    ]);
    const issues = [];
    for (const issue of JSON.parse(raw)) {
      if (!(issue.title || '').startsWith(titlePrefix)) continue;
      const fpMatch = (issue.body || '').match(/code-review-fingerprint:\s*([a-f0-9]+)/);
      issues.push({
        number: issue.number,
        title: (issue.title || '').slice(titlePrefix.length).trim(),
        summary: extractWhat(issue.body || ''),
        state: String(issue.state || '').toLowerCase(),
        stateReason: String(issue.stateReason || '').toLowerCase(),
        closedAt: issue.closedAt || null,
        fingerprint: fpMatch ? fpMatch[1] : null,
      });
    }
    return issues;
  } catch {
    return [];
  }
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

async function main() {
  const discovered = discoverSlices();
  const ledger = reconcileSlices(loadLedger(), discovered);
  if (ledger.slices.length === 0) {
    console.log('reviewCodebaseSlice: no slices discovered under the configured roots.');
    return;
  }

  const slice = pickSlice(ledger, discovered);
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

  const contracts = gatherContracts(slice.name);
  const contractNote = contracts.files.length ? ` + ${contracts.files.length} contract file(s)` : '';
  // The findings already raised for this slice (open + closed). Passed to the reviewer so it doesn't
  // re-report a concern already tracked or already fixed (the main source of re-run churn), and reused
  // below for substance-based dedup. One fetch serves both.
  const sliceIssues = existingSliceIssues(slice.name);
  console.log(`reviewCodebaseSlice: reviewing ${slice.type} ${slice.name} — ${covered}${contractNote} with ${MODEL} (${sliceIssues.length} already-tracked).`);
  const findings = parseFindings(await askClaude(slice, chunk.text, chunkNote, contracts.text, sliceIssues));

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
  ensureLabel('code-review:regression', 'b60205', 'A previously-fixed code-review finding the sweep saw recur');
  ensureLabel('code-review:revisit', 'fbca04', 'A dismissed (won\'t-fix) code-review finding the sweep re-surfaced for a fresh decision');

  // Match new findings to existing slice issues by SUBSTANCE (the model), not by title text — reusing
  // the sliceIssues fetched above. The embedded fingerprint is a free exact-match fast path for the
  // rare run where the title is identical.
  const issuesByNumber = new Map(sliceIssues.map((i) => [i.number, i]));
  const fingerprintToIssue = new Map();
  for (const i of sliceIssues) {
    if (i.fingerprint && !fingerprintToIssue.has(i.fingerprint)) fingerprintToIssue.set(i.fingerprint, i);
  }
  const judged = await judgeDuplicates(slice, findings, sliceIssues);

  let filed = 0;
  for (let idx = 0; idx < findings.length; idx += 1) {
    const finding = findings[idx];
    if (filed >= MAX_ISSUES) {
      console.log(`reviewCodebaseSlice: hit MAX_ISSUES (${MAX_ISSUES}); remaining findings deferred.`);
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
