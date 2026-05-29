#!/usr/bin/env node
/**
 * Posts the generated product update to the in-app feed
 * (via POST {APP_URL}/api/internal/product-update).
 *
 * Wiki page creation and the wiki-site content-index.yaml update are handled by
 * dedicated steps in the workflow (generate-product-update.yml), not here.
 *
 * Required env vars:
 *   UPDATE_JSON              — JSON output from generate-update.mjs
 *   APP_URL                  — Deployed app base URL (e.g. https://the-comic.com)
 *   INTERNAL_SERVICE_SECRET  — Shared secret for /api/internal/* routes
 */

const json = JSON.parse(process.env.UPDATE_JSON ?? '{}');
const { feedTitle, feedBody } = json;

if (!feedTitle || !feedBody) {
  console.error('UPDATE_JSON is missing required fields (feedTitle, feedBody)');
  process.exit(1);
}

const appUrl = process.env.APP_URL;
const secret = process.env.INTERNAL_SERVICE_SECRET;

// Fail fast with an actionable message when required config is absent, rather
// than letting fetch throw a cryptic "Failed to parse URL from undefined/...".
// Both are injected from the Infisical production environment by
// generate-product-update.yml.
const missing = [
  ['APP_URL', appUrl],
  ['INTERNAL_SERVICE_SECRET', secret],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(
    `Missing required env var(s): ${missing.join(', ')}. ` +
      'Both must be defined in the Infisical production environment.',
  );
  process.exit(1);
}

// ── Post to in-app feed ───────────────────────────────────────────────────────

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
