#!/usr/bin/env node
/**
 * Regenerates the public user guide from each member-facing plugin's own documentation.
 *
 * Grounding (this is the whole point): the ONLY facts fed to the model are, per plugin, the
 * inventory's "Intent and Outcome" statement, its "User Features" section, and the test script's
 * "Core smoke" walkthrough — the plain-language, always-current descriptions of what the plugin is,
 * what a member can do, and how. The model rewrites those into the project's plain voice and is told,
 * in the strongest terms, to invent nothing. This mirrors the product-update generator's grounding fix
 * (issue #1471): a public page must never claim a capability its own docs do not state.
 *
 * "Intent and Outcome" is fed for one reason: without it the model had only feature bullets and no
 * statement of what the plugin IS, so it supplied a familiar frame of its own. That is how the guide
 * came to call Workforce — a read-only tracker of how a population's skills are spread across sectors
 * — a list of "job openings" members are "matched to", which no part of Workforce does.
 *
 * Output:
 *   - ctf/packages/web/app/guide/guide-content.json  (rendered by /guide)
 *   - ctf/docs/USER_GUIDE.md                          (a plain markdown copy to share / paste to the wiki)
 *
 * Reads: ANTHROPIC_API_KEY (required — the script refuses to run without it rather than publish
 * ungrounded fallback text). GUIDE_FORCE=1 regenerates every section; otherwise a section whose
 * source docs have not changed since its last generation is kept verbatim with no model call, so a
 * scheduled run with no doc changes costs nothing and opens no PR.
 *
 * Per-section "Last updated" is the last commit date touching that plugin's inventory + test script,
 * so each section honestly reflects how current its source docs are.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const ctfRoot = join(repoRoot, 'ctf');

const INVENTORY_DIR = join(ctfRoot, 'docs/developer/ctf-plugin-feature-inventories');
const TEST_SCRIPT_DIR = join(ctfRoot, 'docs/developer/test-scripts');
const OUT_JSON = join(ctfRoot, 'packages/web/app/guide/guide-content.json');
const OUT_MD = join(ctfRoot, 'docs/USER_GUIDE.md');

// Reading order for the guide — people/connection first, then the ways to contribute, then the
// quieter tools and stats. Only member-facing plugins appear.
//
// Each entry is [slug, display name] plus, when that plugin's docs do not follow the usual
// `ctf-<slug>-feature-inventory.md` / `<slug>-test-script.md` naming, a third entry naming the
// source files. Knowledge Library is the one that needs it today: it is a member-facing plugin of
// its own in the registry, but its documentation lives inside the AI assistant's (`comic`) docs,
// which is exactly why earlier passes silently left it out of the guide. That third entry can also
// carry `smokeHeading` (the test-script heading holding the member walkthrough, when the script does
// not use "Core smoke") and `focus` (one line telling the model which part of a shared document this
// section covers, so it does not write about the rest of the file).
const ORDER = [
  // Commons is the home page and the app list itself, so earlier passes left it out of the guide;
  // members still need it explained (owner decision, 2026-08-18) — it leads the reading order as
  // the surface everyone lands on first.
  ['commons', 'Commons'],
  ['directory', 'Directory'],
  ['foundation', 'Foundation'],
  ['chyme', 'Chyme'],
  [
    'mutual-time',
    'Mutual Time',
    {
      // Mutual Time is in ADMIN_ONLY_PLUGIN_SLUGS, so it is not a tile in the member launcher — the
      // owner runs the polls. Members still use it, every time: they open the shared event link and
      // pick their times. That member half is what this section covers.
      focus:
        'This section is ONLY about what a member does with a shared Mutual Time link at /mutual-time/<slug> — seeing the event, picking the hours they are free, and reading the chosen time afterwards. Creating, opening, and closing an event is the owner\'s side; write nothing about it.',
    },
  ],
  ['socket-relay', 'SocketRelay'],
  ['beacon', 'Beacon'],
  ['peer-programming', 'PeerProgramming'],
  ['mood', 'Mood'],
  ['what-works', 'WhatWorks'],
  ['skills-hunt', 'SkillsHunt'],
  ['workforce', 'Workforce'],
  ['skills-taxonomy', 'Skills Taxonomy'],
  ['service-credits', 'ServiceCredits'],
  ['contributions', 'Contributions'],
  [
    'knowledge',
    'Knowledge Library',
    {
      inventory: 'ctf-comic-feature-inventory.md',
      testScript: 'comic-test-script.md',
      smokeHeading: /Pick a few posts/i,
      focus:
        'This section is ONLY about the Knowledge Library at /knowledge — lending your own public Quora writing to the assistant, and taking it back. The source documents also describe the AI assistant itself (asking it questions, rating its answers); ignore all of that and write nothing about it.',
    },
  ],
  ['level-up', 'LevelUp'],
  ['trust', 'Trust'],
  ['trust-transport', 'TrustTransport'],
  ['lighthouse', 'LightHouse'],
  ['click-log', 'ClickLog'],
  ['recurring-activity', 'Recurring Activity'],
  ['gdp', 'GDP'],
];

// Trust and Knowledge Library were both missing from the guide for months because ORDER is a
// hand-kept list and nothing compared it to the plugins members can actually see. This prints the
// difference on every run: any plugin a member finds in their launcher that the guide never
// mentions. It is a notice, not a failure, but the omission is now visible in the run log instead of
// waiting to be noticed.
//
// A plugin is only counted when a member can see its tile: `isVisible: true` in the registry AND not
// in `ADMIN_ONLY_PLUGIN_SLUGS`, which is the set the launcher filters out for everyone but the owner.
// Reading `isVisible` alone reported Weekly Performance (an operator analytics screen with no member
// side at all) and Mutual Time as gaps, which they are not.
function noticeMissingFromGuide() {
  const registryFile = join(ctfRoot, 'packages/web/lib/plugins/repository.ts');
  if (!existsSync(registryFile)) return;
  const src = readFileSync(registryFile, 'utf-8');
  const adminOnly = new Set(
    (/ADMIN_ONLY_PLUGIN_SLUGS = new Set<string>\(\[([^\]]*)\]/.exec(src)?.[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean),
  );
  const covered = new Set(ORDER.map(([slug]) => slug));
  const missing = [];
  const entry = /slug: '([^']+)',[\s\S]{0,600}?isVisible: (true|false),/g;
  let m = entry.exec(src);
  while (m) {
    const slug = m[1];
    if (m[2] === 'true' && !adminOnly.has(slug) && !covered.has(slug)) missing.push(slug);
    m = entry.exec(src);
  }
  if (missing.length) {
    console.error(
      `notice: these plugins appear in the member launcher but have no guide section: ${missing.join(', ')}. ` +
        'Add each one to ORDER, or decide it is not something a member needs explained.',
    );
  }
}

const repoUrl = 'https://github.com/chargingthefuture/chargingthefuture';

const brandVoice = existsSync(join(ctfRoot, 'docs/BRAND_VOICE_LEXICON.md'))
  ? readFileSync(join(ctfRoot, 'docs/BRAND_VOICE_LEXICON.md'), 'utf-8').slice(0, 2500)
  : '';

// ── Source resolution ──────────────────────────────────────────────────────────

function inventoryPath(slug, override) {
  if (override) {
    const named = join(INVENTORY_DIR, override);
    return existsSync(named) ? named : null;
  }
  const direct = join(INVENTORY_DIR, `ctf-${slug}-feature-inventory.md`);
  if (existsSync(direct)) return direct;
  // A few slugs map to a differently-named inventory file (e.g. gdp → gross-domestic-product).
  const found = readdirSync(INVENTORY_DIR).find(
    (f) => f.startsWith('ctf-') && f.includes(slug) && f.endsWith('-feature-inventory.md'),
  );
  if (found) return join(INVENTORY_DIR, found);
  if (slug === 'gdp') {
    const gdp = join(INVENTORY_DIR, 'ctf-gross-domestic-product-feature-inventory.md');
    if (existsSync(gdp)) return gdp;
  }
  return null;
}

function testScriptPath(slug, override) {
  const p = join(TEST_SCRIPT_DIR, override ?? `${slug}-test-script.md`);
  return existsSync(p) ? p : null;
}

// Return the body of the first markdown section whose heading matches `headingRe`, stopping at the
// next heading of the same or higher level. Empty string when not found.
function extractSection(md, headingRe) {
  const lines = md.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (m && headingRe.test(m[2])) {
      start = i + 1;
      level = m[1].length;
      break;
    }
  }
  if (start === -1) return '';
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+/.exec(lines[i]);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

// Trim `text` to at most `limit` characters, cutting at the last paragraph break inside the limit so
// a truncated block never ends mid-sentence (the model reads a half-sentence as a finished claim).
// Inventory prose is hard-wrapped, so a bare line break usually sits mid-sentence; fall back to one
// only when there is no blank line to cut at, and to a hard slice when there is neither.
function capAtParagraph(text, limit) {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const cut = Math.max(head.lastIndexOf('\n\n'), 0) || head.lastIndexOf('\n');
  const kept = (cut > 0 ? head.slice(0, cut) : head).trimEnd();
  // A trailing lead-in ("The plugin, stated precisely:") whose list was cut promises something the
  // model never receives, so drop the dangling line rather than hand over an unanswered colon.
  return kept.endsWith(':') ? kept.slice(0, kept.lastIndexOf('\n')).trimEnd() : kept;
}

// Last commit date (YYYY-MM-DD) touching any of the given files; today when git is unavailable.
function lastUpdated(paths) {
  const real = paths.filter(Boolean);
  if (real.length === 0) return new Date().toISOString().slice(0, 10);
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%ad', '--date=short', '--', ...real],
      { cwd: repoRoot, encoding: 'utf-8' },
    ).trim();
    return out || new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ── Model call ───────────────────────────────────────────────────────────────

const GROUNDING = `GROUNDING — DO NOT FABRICATE (most important rule, overrides everything):
- The three source blocks below (this plugin's "What it is", its "User Features", and its "Core smoke" steps) are your ONLY facts. Every claim you write must trace to them. If they do not say it, you do not write it.
- Invent no capability, number, date, rating, or outcome. When unsure what something does, say less — a vaguer true sentence beats a specific false one. A short section is fine.
- Keep the frame the docs give you. Never swap a documented term for a familiar real-world one that means something different — a headcount worked out from a population model is not a "job opening", a list of skills is not a "job board", and a count is not a rating. If a plain word for it is not in the sources, describe what the screen shows instead of naming it.
- ServiceCredits and every in-app credit are an internal, non-fiat unit — never money, cash, a currency, or redeemable for anything outside the app. Never write "payment", "payment plan", "price", "cost", "pay", "buy", "purchase", "refund", "cash out", or a currency symbol about credits. A credit movement is a send, transfer, or exchange; a cohort deposit is held in credits, not paid. Real money unrelated to credits (a listing's actual rent, a confirmed donation in dollars) is real money and is described as such.
- The platform verifies NO ONE's identity, background, or work, and has no trust "score". Never write "verified", "verification", "vetted", "background check", or "trust score", even for Directory, Foundation, or Trust features. Foundation helpers are fellow community members, not a formally vetted service. Trust features are peer/social information only.
- Describe MEMBER actions only. Skip anything admin-only.`;

const VOICE = `VOICE:
- Plain, about a 6th-grade reading level. Short sentences. Everyday words. Write to a capable adult, plainly.
- Built and run by a single operator, not a company: never use "we", "our", or "us". Prefer person-free sentences ("Open X and pick…"); a singular "I" only if unavoidable.
- No selling ("powerful", "seamless", "game-changer", "matters deeply"), no rhetorical questions, no closing flourish, no guessing at the reader's feelings.
- Never use any of these words: thanks, sorry, glad, happy, excited, feel free, hope, phase, punch list.`;

// Pull the JSON object out of the model's reply. Haiku often wraps it in a ```json fence or adds a
// line of preamble, so a strict JSON.parse of the raw text rejects a perfectly good answer (that is
// what silently preserved the old wording on the first successful run). Strip a fence if present,
// else slice from the first "{" to the last "}".
function extractJson(text) {
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (!t.startsWith('{')) {
    const open = t.indexOf('{');
    const close = t.lastIndexOf('}');
    if (open >= 0 && close > open) t = t.slice(open, close + 1);
  }
  return t;
}

async function rewrite(slug, title, whatItIs, features, coreSmoke, focus) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You write a plain-language user guide for Charging the Future, a platform for survivors of Specterati harassment.\n\n${GROUNDING}\n\n${VOICE}\n\nBRAND VOICE NOTES:\n${brandVoice}`,
      messages: [
        {
          role: 'user',
          content: `Write the "${title}" section of the user guide, grounded ONLY in the three source blocks below.\n${focus ? `\nSCOPE: ${focus}\n` : ''}\n=== ${title} — What it is (developer notes on the point of this plugin) ===\n${whatItIs || '(none documented)'}\n\nUse that first block only to get the framing right — what this plugin is and is not. It is written for developers, so never copy its wording, its rule numbers, its file paths, or its planning notes into the guide. Everything a member can DO comes from the two blocks below.\n\n=== ${title} — User Features (what a member can do) ===\n${features || '(none documented)'}\n\n=== ${title} — Core smoke (plain member steps) ===\n${coreSmoke || '(none documented)'}\n\nReturn ONLY a JSON object with these exact keys:\n- summary: one plain sentence saying what ${title} is for.\n- body: an array of 1 to 3 short plain paragraphs on what a member can do here (strings).\n- howTo: an array of 2 to 4 plain steps for using it, drawn from the Core smoke block (strings). Use an empty array if there is no meaningful walkthrough.\n\nReturn ONLY valid JSON. No markdown fences. No preamble.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    // Log the API's own error message, not just the status, so a bad model id / request is
    // diagnosable from the run log rather than a bare "400".
    const detail = await res.text().catch(() => '');
    console.error(`  model call failed for ${slug}: ${res.status} ${detail.slice(0, 300)}`);
    return null;
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '';
  try {
    const parsed = JSON.parse(extractJson(text));
    return {
      summary: String(parsed.summary ?? '').trim(),
      body: (Array.isArray(parsed.body) ? parsed.body : []).map((s) => String(s).trim()).filter(Boolean),
      howTo: (Array.isArray(parsed.howTo) ? parsed.howTo : []).map((s) => String(s).trim()).filter(Boolean),
    };
  } catch {
    console.error(`  could not parse model JSON for ${slug}`);
    return null;
  }
}

// ── Build ──────────────────────────────────────────────────────────────────────

// A keyless (or Infisical-failed) run must NEVER regenerate the guide: the model is the only thing
// that turns the raw docs into plain, grounded prose, so without it this script would publish
// ungrounded doc-scrapings to a public page (that is exactly how the fallback dump once shipped).
// Fail loudly instead and leave the committed guide untouched.
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set — refusing to regenerate the user guide. The guide is left unchanged.');
  process.exit(1);
}

// Load the current guide so a single section whose model call fails keeps its reviewed wording
// rather than being blanked or replaced with raw text.
const prev = new Map(
  (existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, 'utf-8')).sections ?? [] : []).map((s) => [s.id, s]),
);
const prevIntro = existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, 'utf-8')).intro : null;

noticeMissingFromGuide();

const sections = [];
for (const [slug, title, sources] of ORDER) {
  const invPath = inventoryPath(slug, sources?.inventory);
  const tsPath = testScriptPath(slug, sources?.testScript);
  const inv = invPath ? readFileSync(invPath, 'utf-8') : '';
  const ts = tsPath ? readFileSync(tsPath, 'utf-8') : '';
  // "Intent and Outcome" states what the plugin IS. Without it the model has only feature bullets
  // and reaches for a familiar frame that may be wrong (see the Workforce note at the top of this
  // file). Every member-facing inventory carries the heading as of 2026-08-18; one that does not
  // falls back to the other two blocks. Capped because these sections carry developer planning notes
  // the model does not need — only the longest (PeerProgramming) is near the cap today — and the cap
  // lands on a paragraph break so the block never ends mid-sentence and reads as a truncated claim.
  const whatItIs = capAtParagraph(extractSection(inv, /Intent (and|&) Outcome/i), 2500);
  const features = extractSection(inv, /User Features/i);
  const coreSmoke = extractSection(ts, sources?.smokeHeading ?? /Core smoke/i);
  const updated = lastUpdated([invPath, tsPath]);

  // Cost control: the guide is regenerated on a schedule (see the workflow), so most runs happen
  // with no doc changes. Skip the model call for any section whose source docs have not changed
  // since it was last generated — its `updated` date already equals the source's last-commit date.
  // A GUIDE_FORCE=1 run (manual "force full rebuild") regenerates everything.
  const existing = prev.get(slug);
  if (process.env.GUIDE_FORCE !== '1' && existing && existing.updated === updated) {
    console.error(`  ${slug}: source docs unchanged since ${updated} — keeping current section (no API call).`);
    sections.push(existing);
    continue;
  }

  console.error(`generating ${slug}…`);
  const written = await rewrite(slug, title, whatItIs, features, coreSmoke, sources?.focus);
  if (!written || !written.summary || !written.body.length) {
    // Model call failed or returned nothing usable. Keep the reviewed section as-is (only bumping
    // its date); fail only if there is no prior section to preserve.
    const keep = prev.get(slug);
    if (!keep) {
      console.error(`no usable content for ${slug} and no previous section to keep — failing.`);
      process.exit(1);
    }
    sections.push({ ...keep, updated });
    continue;
  }
  sections.push({
    id: slug,
    title,
    updated,
    summary: written.summary,
    body: written.body,
    ...(written.howTo && written.howTo.length ? { howTo: written.howTo } : {}),
  });
}

const overallUpdated = sections
  .map((s) => s.updated)
  .sort()
  .reverse()[0] ?? new Date().toISOString().slice(0, 10);

const guide = {
  updated: overallUpdated,
  // Keep the reviewed intro if one exists; only seed a default on a first-ever build.
  intro: Array.isArray(prevIntro) && prevIntro.length
    ? prevIntro
    : [
        'Charging the Future is a set of apps survivors use to work with and support each other, outside the Specterati economy. This guide walks through each part: what it does and how to use it.',
        'Pick an app from the list below to jump to it.',
      ],
  sections,
};

writeFileSync(OUT_JSON, `${JSON.stringify(guide, null, 2)}\n`);

// Plain markdown copy — easy to share and to paste into the GitHub wiki.
const md = [
  '# How to use Charging the Future',
  '',
  `_Last updated: ${overallUpdated}_`,
  '',
  ...guide.intro,
  '',
  ...sections.flatMap((s) => [
    `## ${s.title}`,
    '',
    `_Last updated: ${s.updated}_`,
    '',
    s.summary,
    '',
    ...s.body.flatMap((p) => [p, '']),
    ...(s.howTo && s.howTo.length ? ['**How to use it**', '', ...s.howTo.map((step, i) => `${i + 1}. ${step}`), ''] : []),
  ]),
  `The code is open source at ${repoUrl}.`,
  '',
].join('\n');

writeFileSync(OUT_MD, md);

console.error(`Wrote ${sections.length} sections. Overall last updated ${overallUpdated}.`);
