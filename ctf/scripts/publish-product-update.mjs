#!/usr/bin/env node
/**
 * Posts the generated product update to:
 *   1. The in-app feed (via /api/internal/product-update)
 *   2. The wiki-site content-index.yaml (via GitHub Contents API)
 *
 * Wiki page creation happens via git in the workflow (generate-product-update.yml)
 * because GitHub has no REST API for wiki pages.
 *
 * Required env vars:
 *   UPDATE_JSON              — JSON output from generate-update.mjs
 *   APP_URL                  — Deployed app base URL (e.g. https://app.chargingthefuture.org)
 *   INTERNAL_SERVICE_SECRET  — Shared secret for /api/internal/* routes
 *   GH_PAT                   — GitHub PAT with contents:write on wiki-site repo
 */

const json = JSON.parse(process.env.UPDATE_JSON ?? '{}');
const { feedTitle, feedBody, wikiPageName, wikiSiteExcerpt } = json;

if (!feedTitle || !feedBody || !wikiPageName || !wikiSiteExcerpt) {
  console.error('UPDATE_JSON is missing required fields');
  process.exit(1);
}

const appUrl = process.env.APP_URL;
const secret = process.env.INTERNAL_SERVICE_SECRET;
const ghPat = process.env.GH_PAT;
const today = new Date().toISOString().split('T')[0];

// Fail fast with an actionable message when required config is absent, rather
// than letting fetch throw a cryptic "Failed to parse URL from undefined/...".
// These are injected from Infisical (APP_URL, INTERNAL_SERVICE_SECRET) and the
// GitHub Actions secret store (GH_PAT) by generate-product-update.yml.
const missing = [
  ['APP_URL', appUrl],
  ['INTERNAL_SERVICE_SECRET', secret],
  ['GH_PAT', ghPat],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(
    `Missing required env var(s): ${missing.join(', ')}. ` +
      'APP_URL and INTERNAL_SERVICE_SECRET must be defined in the Infisical ' +
      'production environment; GH_PAT must be set as a GitHub Actions secret.',
  );
  process.exit(1);
}

// ── 1. Post to in-app feed ────────────────────────────────────────────────────

const feedRes = await fetch(`${appUrl}/api/internal/product-update`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({ title: feedTitle, body: feedBody }),
});

if (!feedRes.ok) {
  console.error('Feed post failed:', feedRes.status, await feedRes.text());
  process.exit(1);
}

const feedData = await feedRes.json();
console.log(`Feed announcement published (id: ${feedData.id})`);

// ── 2. Update wiki-site content-index.yaml ───────────────────────────────────

const WIKI_SITE_REPO = 'chargingthefuture/wiki-site';
const INDEX_PATH = 'wiki-blog/content-index.yaml';
const API_BASE = 'https://api.github.com';

const ghHeaders = {
  Authorization: `Bearer ${ghPat}`,
  Accept: 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};

const fileRes = await fetch(`${API_BASE}/repos/${WIKI_SITE_REPO}/contents/${INDEX_PATH}`, {
  headers: ghHeaders,
});

if (!fileRes.ok) {
  console.error('Failed to read content-index.yaml:', fileRes.status, await fileRes.text());
  process.exit(1);
}

const fileData = await fileRes.json();
const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

// Prepend so newest appears first; trailing newline is preserved from currentContent
const safeTitle = feedTitle.replace(/"/g, '\\"');
const safeExcerpt = wikiSiteExcerpt.replace(/"/g, '\\"');
const newEntry = [
  `- slug: ${wikiPageName}`,
  `  title: "${safeTitle}"`,
  `  repo: chargingthefuture/chargingthefuture`,
  `  date: "${today}"`,
  `  excerpt: "${safeExcerpt}"`,
  `  category: Updates`,
  '',
].join('\n');

const updatedContent = newEntry + currentContent;

const updateRes = await fetch(`${API_BASE}/repos/${WIKI_SITE_REPO}/contents/${INDEX_PATH}`, {
  method: 'PUT',
  headers: ghHeaders,
  body: JSON.stringify({
    message: `chore: add product update ${today}`,
    content: Buffer.from(updatedContent).toString('base64'),
    sha: fileData.sha,
  }),
});

if (!updateRes.ok) {
  console.error('Failed to update content-index.yaml:', updateRes.status, await updateRes.text());
  process.exit(1);
}

console.log('content-index.yaml updated in wiki-site repo.');
