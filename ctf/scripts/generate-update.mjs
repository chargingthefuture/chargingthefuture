#!/usr/bin/env node
/**
 * Calls the Anthropic API to generate a multi-format product update from recent commits.
 * Reads: ANTHROPIC_API_KEY, COMMITS (env vars)
 * Writes: JSON to stdout
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');

const commits = process.env.COMMITS ?? '';
if (!commits.trim()) {
  console.error('COMMITS env var is empty — nothing to generate');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set');
  process.exit(1);
}

const brandVoice = readFileSync(
  join(repoRoot, 'ctf/docs/BRAND_VOICE_LEXICON.md'),
  'utf-8',
).slice(0, 3000);

// Date in the runner's local timezone (TZ env, set by the workflow) as
// YYYY-MM-DD. Avoids toISOString(), which is always UTC and can land on the
// next day shortly after local midnight. en-CA gives ISO-style YYYY-MM-DD.
const today = new Date().toLocaleDateString('en-CA');

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `You write product updates for Charging the Future, an open-source platform built for survivors of Specterati harassment. Follow the brand voice guide carefully.\n\nBRAND VOICE:\n${brandVoice}\n\nToday: ${today}`,
    messages: [
      {
        role: 'user',
        content: `Recent commits merged to main:\n\n${commits}\n\nGenerate a product update. Return ONLY a JSON object with these exact keys:\n- feedTitle: In-app announcement title (max 80 chars, plain language)\n- feedBody: 2-3 sentence in-app announcement. Calm, empowering, no jargon.\n- wikiPageName: Wiki page filename. Format: Product-Update-${today}-Short-Title (hyphens only, no spaces, no special chars)\n- wikiContent: Full markdown page. Include ## What Shipped and ## Why It Matters sections.\n- wikiSiteExcerpt: One sentence summary for the content index (max 150 chars)\n- quoraDraft: 3-5 paragraph Quora post. Narrative style — explain what was built and why it matters to survivors. End with an invitation to follow the project's progress.\n\nReturn ONLY valid JSON. No markdown fences. No preamble.`,
      },
    ],
  }),
});

if (!response.ok) {
  console.error('Anthropic API error:', response.status, await response.text());
  process.exit(1);
}

const result = await response.json();
const rawContent = result.content[0].text.trim();

// Models sometimes wrap JSON in markdown code fences despite instructions not to.
// Strip a leading ```json / ``` fence and a trailing ``` fence before parsing.
function stripCodeFences(text) {
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : text;
}

const content = stripCodeFences(rawContent);

try {
  JSON.parse(content);
} catch {
  console.error('Model returned invalid JSON:\n', rawContent);
  process.exit(1);
}

process.stdout.write(content + '\n');
