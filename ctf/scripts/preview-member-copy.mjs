#!/usr/bin/env node
// Render member-facing standing copy to PNGs, at phone width, so a human can SEE it before it ships.
//
// WHY. A formatting bug reached members — notice bodies authored as source-wrapped lines rendered with
// hard breaks mid-sentence — and every automated gate passed it, because none of them look at the
// output. A second bug followed: the first-visit card rendered the full notice and swallowed the screen.
// Both were obvious in one glance and invisible to typecheck, lint, and the build.
//
// This does not replace those gates. It produces the artefact that makes copy review possible: attach the
// PNGs to any PR that changes member-facing copy.
//
// Fidelity note, stated plainly: this renders the TEXT and the box, not the live app. It faithfully shows
// line breaking, paragraph spacing, and whether a card overflows a phone screen — the failures that have
// actually happened. It does not prove theme colours or surrounding chrome.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { noticeParagraphs } from '../packages/web/lib/feed/notice-paragraphs.ts';

// Playwright is a dev tool here, not a repo dependency — this script produces a review artefact and is
// not a CI gate, so it should not add weight to every install. Resolve it from the project if present,
// otherwise from a global install, and say plainly what to do if neither is there.
async function loadChromium() {
  for (const specifier of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return (await import(specifier)).chromium;
    } catch {
      // try the next candidate
    }
  }
  console.error(
    'Playwright is not available. This script renders member-facing copy to PNGs for review; run it in an\n' +
    'environment that has Playwright. PLAYWRIGHT_BROWSERS_PATH is already set in the dev container, so no\n' +
    'browser download is needed.',
  );
  process.exit(2);
}

const chromium = await loadChromium();

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'artifacts', 'copy-preview');
const GUIDANCE = join(ROOT, 'packages', 'web', 'lib', 'feed', 'commons-guidance.ts');

// Pull the copy out of the source without importing it — the module reaches for the database, and a
// preview must never need one.
function extractCopy() {
  const src = readFileSync(GUIDANCE, 'utf8');
  const para = (...fragments) => fragments.join(' ');
  const out = {};
  for (const m of src.matchAll(/(?:export )?const (\w+(?:TITLE|BODY)) = ([\s\S]*?);\n/g)) {
    const [, name, expr] = m;
    try {
      // eslint-disable-next-line no-new-func
      out[name] = new Function('para', `return (${expr});`)(para);
    } catch {
      // A constant that does not evaluate standalone is not copy we can preview; skip it rather than fail.
    }
  }
  return out;
}

const copy = extractCopy();

const CARDS = [
  {
    file: 'first-visit-card',
    label: 'First-visit card (shown once, above the chat)',
    title: copy.COMMONS_FIRST_VISIT_TITLE,
    body: copy.COMMONS_FIRST_VISIT_BODY,
    compact: true,
  },
  { file: 'notice-purpose', label: 'Standing notice — every 50 posts', title: 'What the Commons is for', body: copy.COMMONS_PURPOSE_BODY },
  { file: 'notice-rooms', label: 'Standing notice — every 75 posts', title: 'Where things are public, and where the work happens', body: copy.COMMONS_ROOMS_BODY },
  { file: 'notice-signal', label: 'Standing notice — every 21 days', title: 'Who I interact with is not a vouch', body: copy.COMMONS_SIGNAL_BODY },
].filter((c) => typeof c.body === 'string' && c.body.length > 0);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderCard(card) {
  const paragraphs = noticeParagraphs(card.body)
    .map((lines) => `<p>${lines.map(escapeHtml).join('<br/>')}</p>`)
    .join('');
  return `<section class="card ${card.compact ? 'compact' : ''}">
    <h2>${escapeHtml(card.title ?? '')}</h2>
    <div class="body">${paragraphs}</div>
  </section>`;
}

const PHONE = { width: 390, height: 844 };

const page = (card) => `<!doctype html><meta charset="utf-8"><style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0B0711; color:#F5E6C8; font:400 14px/1.6 Inter,system-ui,sans-serif; }
  .frame { width:${PHONE.width}px; min-height:${PHONE.height}px; box-sizing:border-box; padding:12px; }
  .banner { font:600 11px/1.4 monospace; color:#9CA3AF; padding:6px 8px; margin-bottom:8px;
            border:1px dashed #3A3A46; border-radius:6px; }
  .card { border:1px solid rgba(196,181,253,.35); background:rgba(196,181,253,.08);
          border-radius:12px; padding:14px 16px; }
  .card.compact { font-size:12.5px; line-height:1.55; }
  h2 { margin:0 0 6px; font-size:13.5px; font-weight:800; }
  .body p { margin:0; }
  .body p + p { margin-top:.75em; }
  /* The line that marks the fold. Anything below it needs scrolling on a phone — for the first-visit
     card, which must never scroll, content crossing this line is the bug. */
  .fold { position:absolute; left:0; right:0; top:${PHONE.height}px; border-top:2px dashed #EF4444; }
  .foldLabel { position:absolute; right:4px; top:${PHONE.height + 4}px; font:600 10px monospace; color:#EF4444; }
</style>
<div class="frame">
  <div class="banner">${escapeHtml(card.label)} · ${PHONE.width}px wide</div>
  ${renderCard(card)}
</div>
<div class="fold"></div><div class="foldLabel">phone fold (${PHONE.height}px)</div>`;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
const tab = await ctx.newPage();

const results = [];
for (const card of CARDS) {
  await tab.setContent(page(card), { waitUntil: 'load' });
  const height = await tab.evaluate(() => document.querySelector('.frame').getBoundingClientRect().height);
  const path = join(OUT, `${card.file}.png`);
  await tab.screenshot({ path, fullPage: true });
  results.push({ file: `${card.file}.png`, label: card.label, height: Math.round(height), overflows: height > PHONE.height });
  console.log(`  ${card.file}.png  ${Math.round(height)}px${height > PHONE.height ? '  ← taller than a phone screen' : ''}`);
}

await browser.close();
writeFileSync(join(OUT, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(`\nWrote ${results.length} preview(s) to ctf/artifacts/copy-preview/.`);

// The first-visit card must fit — it sits in a fixed-height column above the chat, so when it is taller
// than the screen the member ends up scrolling the CONVERSATION past it. That already happened once.
const card = results.find((r) => r.file === 'first-visit-card.png');
if (card?.overflows) {
  console.error('\n❌ The first-visit card is taller than a phone screen. It must fit without scrolling.');
  process.exit(1);
}
