#!/usr/bin/env node
// Generate (or refresh) the MANUAL test script for one or more plugins.
//
// This is the "manual testing" half of the same incremental sweep that powers the code-review
// pipeline. Code review reads the code and files issues for an agent to fix. This reads the same
// source of truth — each plugin's feature inventory and declared contracts — and writes a
// human-runnable test script: the steps to walk on a real device to confirm the plugin works,
// tagged by role (member/admin) and surface (web desktop / mobile-responsive / android).
//
// Why a separate artifact from code review: code review sees static code; it cannot see a button
// that renders off-screen at 390px, a 500 from the live Clerk/Stream/Formance integration, seed
// data that does not render, or a parity gap between web and android. Those only show up when a
// person runs the app. So the deliverable here is a checklist for YOU to execute, not an issue an
// implement-bot can auto-fix.
//
// Output: ctf/docs/developer/test-scripts/<slug>-test-script.md (one per plugin), derived from the
// plugin's row in ctf/config/manual-test-script-manifest.json.
//
// Selection modes (pick one):
//   TEST_SCRIPT_SLICE=<slug|name>   Generate exactly this plugin (the on-demand path).
//   TEST_SCRIPT_DIFF=<base-ref>     Generate every plugin touched by `git diff <base>...HEAD`
//                                   (the "I just changed something, re-test it" path).
//   TEST_SCRIPT_FROM_REVIEW=1       Generate the plugin the code-review sweep most recently
//                                   reviewed (reads ctf/config/code-review-ledger.json). This is the
//                                   rotation hook: one rotation, two artifacts.
//   TEST_SCRIPT_ALL=1               Generate all plugins in the manifest.
//
// Required environment:
//   ANTHROPIC_API_KEY   For the model call. Absent -> the script no-ops (harmless to schedule).
//
// Optional environment:
//   TEST_SCRIPT_MODEL          Model id (default: claude-sonnet-4-6).
//   TEST_SCRIPT_MAX_BYTES      Per-plugin inventory byte budget (default: 90000).
//   TEST_SCRIPT_DRY_RUN        "1" to print the markdown without writing files.
//
// A slug may also be passed as the first CLI argument: `node generateManualTestScript.mjs gdp`.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const manifestPath = join(repoRoot, 'ctf/config/manual-test-script-manifest.json');
const reviewLedgerPath = join(repoRoot, 'ctf/config/code-review-ledger.json');

const MODEL = (process.env.TEST_SCRIPT_MODEL || 'claude-sonnet-4-6').trim();
const MAX_BYTES = Number(process.env.TEST_SCRIPT_MAX_BYTES || '90000');
const CONTRACTS_MAX_BYTES = Number(process.env.TEST_SCRIPT_CONTRACTS_MAX_BYTES || '40000');
const MAX_OUTPUT_TOKENS = Number(process.env.TEST_SCRIPT_MAX_OUTPUT_TOKENS || '8000');
const DRY_RUN = process.env.TEST_SCRIPT_DRY_RUN === '1';

const CONTRACTS_DIR = 'ctf/docs/contracts';
const CONTRACT_SUFFIXES = [
  '_PLUGIN_COMMAND_CONTRACTS.yaml',
  '_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml',
  '_PLUGIN_AUDIT_CONTRACTS.yaml',
  '_PROFILE_AND_DELETION_CONTRACT.md',
];
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '__snapshots__', '.turbo']);

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('generateManualTestScript: ANTHROPIC_API_KEY not set; nothing to do.');
  process.exit(0);
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function loadManifest() {
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(parsed.plugins) || parsed.plugins.length === 0) {
    throw new Error('manual-test-script-manifest.json has no plugins.');
  }
  return parsed;
}

// Resolve a plugin by slug or display name, trimmed and case-insensitive.
function findPlugin(manifest, wanted) {
  const needle = String(wanted || '').trim().toLowerCase();
  return manifest.plugins.find(
    (p) => p.slug.toLowerCase() === needle || p.name.toLowerCase() === needle,
  );
}

// Map a repo-relative changed file to the plugin that owns it: its codeDirs or its inventory file.
function pluginForPath(manifest, file) {
  const invDir = manifest.inventoryDir;
  for (const p of manifest.plugins) {
    if (file === `${invDir}/${p.inventory}`) {
      return p;
    }
    for (const dir of p.codeDirs) {
      if (file === dir || file.startsWith(`${dir}/`)) {
        return p;
      }
    }
  }
  return null;
}

function changedFiles(baseRef) {
  const out = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

// The slice the code-review sweep most recently completed (newest lastReviewedAt), mapped to a
// manifest plugin by matching the slice name against the last segment of any plugin codeDir
// (handles the irregular cases, e.g. api dir `bug-reports` -> plugin `bug-reporting`).
function pluginFromReviewLedger(manifest) {
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(reviewLedgerPath, 'utf8'));
  } catch {
    return null;
  }
  const reviewed = (ledger.slices || []).filter((s) => s.lastReviewedAt);
  if (reviewed.length === 0) {
    return null;
  }
  reviewed.sort((a, b) => new Date(b.lastReviewedAt) - new Date(a.lastReviewedAt));
  const name = reviewed[0].name.toLowerCase();
  // Direct slug match first, then last-path-segment match against codeDirs.
  return (
    findPlugin(manifest, name) ||
    manifest.plugins.find((p) =>
      p.codeDirs.some((dir) => dir.split('/').pop().toLowerCase() === name),
    ) ||
    null
  );
}

function resolveTargets(manifest) {
  const cliSlug = process.argv[2];
  const forced = process.env.TEST_SCRIPT_SLICE || cliSlug;
  if (forced) {
    const p = findPlugin(manifest, forced);
    if (!p) {
      const valid = manifest.plugins.map((x) => x.slug).join(', ');
      console.error(`generateManualTestScript: unknown plugin '${forced}'. Valid: ${valid}`);
      process.exit(1);
    }
    return [p];
  }
  if (process.env.TEST_SCRIPT_DIFF) {
    const files = changedFiles(process.env.TEST_SCRIPT_DIFF);
    const set = new Map();
    for (const f of files) {
      const p = pluginForPath(manifest, f);
      if (p) set.set(p.slug, p);
    }
    return [...set.values()];
  }
  if (process.env.TEST_SCRIPT_FROM_REVIEW === '1') {
    const p = pluginFromReviewLedger(manifest);
    return p ? [p] : [];
  }
  if (process.env.TEST_SCRIPT_ALL === '1') {
    return manifest.plugins;
  }
  console.error(
    'generateManualTestScript: choose a mode — TEST_SCRIPT_SLICE=<slug>, TEST_SCRIPT_DIFF=<base>, ' +
      'TEST_SCRIPT_FROM_REVIEW=1, or TEST_SCRIPT_ALL=1 (or pass a slug as the first argument).',
  );
  process.exit(1);
}

function readCapped(absPath, budget) {
  let body = readFileSync(absPath, 'utf8');
  if (body.length > budget) {
    body = `${body.slice(0, budget)}\n... (truncated to fit the budget) ...`;
  }
  return body;
}

function gatherContracts(slug) {
  const prefix = slug.toUpperCase().replace(/-/g, '_');
  let text = '';
  for (const suffix of CONTRACT_SUFFIXES) {
    if (text.length >= CONTRACTS_MAX_BYTES) break;
    const rel = `${CONTRACTS_DIR}/${prefix}${suffix}`;
    let body;
    try {
      body = readFileSync(join(repoRoot, rel), 'utf8');
    } catch {
      continue;
    }
    const header = `\n----- CONTRACT: ${rel} -----\n`;
    const room = CONTRACTS_MAX_BYTES - text.length - header.length;
    if (room <= 0) break;
    if (body.length > room) body = `${body.slice(0, room)}\n... (truncated) ...`;
    text += header + body;
  }
  return text;
}

// A compact list of the plugin's real route/screen files, so steps name surfaces that exist.
function listSurfaces(plugin) {
  const files = [];
  const walk = (absDir) => {
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const abs = join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith('.d.ts')) {
        files.push(relative(repoRoot, abs));
      }
    }
  };
  for (const dir of plugin.codeDirs) {
    const abs = join(repoRoot, dir);
    if (isDir(abs)) walk(abs);
  }
  return files.sort().slice(0, 80);
}

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
    console.warn('generateManualTestScript: response hit max_tokens; the script may be truncated.');
  }
  return result.content[0].text.trim();
}

function buildSystemPrompt() {
  return [
    'You write a MANUAL test script for one plugin of "Charging the Future", an open-source',
    'Next.js (web) + React Native (android) app. The reader runs these steps by hand on a real',
    'device — usually a phone — to confirm the plugin works. Follow CLAUDE.md: plain language, no',
    'jargon, no pleasantries, no "phases".',
    '',
    'Derive the steps ONLY from the feature inventory and contracts given to you — they are the',
    'source of truth for what the plugin should do. Do not invent features. Turn each real',
    'user-facing and admin behavior into a concrete, observable check: a precondition, the steps to',
    'do, and the exact expected result. Prefer fewer high-signal cases over exhaustive coverage.',
    '',
    'Every case must state the role (member/admin) and the surfaces it applies to, and end with a',
    'result line carrying a checkbox per surface: "web ☐ mobile ☐ android ☐". A failed check becomes',
    'a row in the Bug Reporting plugin.',
    '',
    'Output ONLY the markdown document — no code fences around the whole thing, no preamble. Match',
    'this exact structure and tone:',
    '',
    '# <Name> — Manual Test Script',
    '> one-line note that it is generated from the inventory + contracts and is the runnable checklist;',
    '> include the regenerate command: `pnpm --dir ctf test-script:generate -- <slug>`',
    'A metadata table with rows: Plugin, Visibility, Roles to test, Surfaces, Seed first, Source inventory, Generated.',
    'Set the **Generated** cell to the literal token GENERATED_STAMP (it is replaced after generation).',
    '## How to run this  (bullets: ✅ pass / ❌ fail / ⛔ blocked; a ❌ becomes a Bug Reporting row; run Core smoke every session)',
    '## Core smoke (every session)  — the few can\'t-ship-broken checks, numbered, each with surface checkboxes',
    '## Member walkthrough  — cases IDed <PREFIX>-1, <PREFIX>-2, ... each: Role/Surfaces/Precondition, Steps, Expected, Result line with checkboxes',
    '## Admin walkthrough  — cases IDed <PREFIX>-A1, ... (omit if the plugin has no admin features)',
    '## Parity check (web ↔ android)  — which cases must behave identically across surfaces',
    '## Known gaps — do not file these as bugs  — pulled from the inventory\'s "Gaps and Known Technical Debt" section',
    '',
    'Use a short uppercase case-ID prefix derived from the plugin name (e.g. ServiceCredits -> SC,',
    'GDP -> GDP, Mood -> MD). If the plugin is admin-only or internal, say so in the metadata and',
    'skip the member walkthrough (test only the admin/internal entry points).',
  ].join('\n');
}

function buildUserPrompt(plugin, inventoryText, contractsText, surfaces) {
  return [
    `Plugin: ${plugin.name} (slug \`${plugin.slug}\`)`,
    `Visibility: ${plugin.visibility}`,
    `Roles to test: ${plugin.roles.join(', ')}`,
    `Seed command to run first: pnpm --dir ctf ${plugin.seed}`,
    `Source inventory path: ctf/docs/developer/ctf-plugin-feature-inventories/${plugin.inventory}`,
    '',
    'Surfaces (real route/screen files in this plugin — name only existing ones):',
    surfaces.length ? surfaces.map((s) => `  ${s}`).join('\n') : '  (no source files found for this plugin yet)',
    '',
    '===== FEATURE INVENTORY (source of truth) =====',
    inventoryText,
    ...(contractsText
      ? ['', '===== DECLARED CONTRACTS (rules the plugin must obey) =====', contractsText]
      : []),
    '',
    'Write the manual test script now, following the required structure exactly.',
  ].join('\n');
}

function stamp() {
  let sha = 'unknown';
  try {
    sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    /* no-trace: not a git checkout, so the sha stays 'unknown' */
  }
  const date = new Date().toISOString().slice(0, 10);
  return `${date} (commit ${sha})`;
}

async function generateOne(manifest, plugin) {
  const invAbs = join(repoRoot, manifest.inventoryDir, plugin.inventory);
  let inventoryText;
  try {
    inventoryText = readCapped(invAbs, MAX_BYTES);
  } catch {
    console.warn(`generateManualTestScript: no inventory for ${plugin.slug} at ${plugin.inventory}; skipping.`);
    return false;
  }
  const contractsText = gatherContracts(plugin.slug);
  const surfaces = listSurfaces(plugin);

  console.log(`generateManualTestScript: ${plugin.slug} (${surfaces.length} source file(s)) with ${MODEL}.`);
  const raw = await anthropicMessage(buildSystemPrompt(), buildUserPrompt(plugin, inventoryText, contractsText, surfaces), MAX_OUTPUT_TOKENS);

  // Strip an accidental wrapping code fence and stamp the Generated cell.
  const fenced = raw.match(/^```(?:markdown)?\s*\n([\s\S]*?)\n?```$/i);
  let markdown = (fenced ? fenced[1] : raw).trim();
  markdown = markdown.replace(/GENERATED_STAMP/g, stamp());
  if (!markdown.startsWith('#')) {
    console.warn(`generateManualTestScript: ${plugin.slug} output did not look like markdown; writing anyway.`);
  }
  const outRel = `${manifest.outputDir}/${plugin.slug}-test-script.md`;
  if (DRY_RUN) {
    console.log(`----- ${outRel} -----\n${markdown}\n`);
    return true;
  }
  const outAbs = join(repoRoot, outRel);
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, `${markdown}\n`);
  console.log(`generateManualTestScript: wrote ${outRel}`);
  return true;
}

async function main() {
  const manifest = loadManifest();
  const targets = resolveTargets(manifest);
  if (targets.length === 0) {
    console.log('generateManualTestScript: no plugins selected; nothing to do.');
    return;
  }
  let wrote = 0;
  for (const plugin of targets) {
    if (await generateOne(manifest, plugin)) wrote += 1;
  }
  console.log(`generateManualTestScript: generated ${wrote} of ${targets.length} selected plugin(s).`);
}

main().catch((error) => {
  console.error('generateManualTestScript failed:', error?.message || error);
  process.exit(1);
});
