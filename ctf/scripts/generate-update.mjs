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

// The one and only place the project's code lives. The model must not be left
// to guess this — a draft once invented "chargingthefuture/ctf" (issue #448).
const repoUrl = 'https://github.com/chargingthefuture/chargingthefuture';

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
    system: `You write product updates for Charging the Future, an open-source platform built for survivors of Specterati harassment. Follow the brand voice guide carefully.\n\nGROUNDING — DO NOT FABRICATE (this is the most important rule; it overrides every other instinct):\n- The commit list below is your ONLY source of facts. Every concrete claim you write — what a feature does, who it is for, how someone uses it — must trace directly to a commit's subject or body. If the commits do not say it, you do not write it.\n- Describe ONLY what these commits changed in this window. Most windows are small fixes and adjustments, not launches. Do NOT announce a feature as "now live", "launching", "new", or "introducing" unless a commit in this list actually adds that feature for the first time. A commit that fixes, adjusts, or makes something visible is NOT a launch — describe the fix, not a debut.\n- Never invent a capability. In particular the platform does NOT verify anyone's identity, background, or work, and has no trust "score" — so never write "verification", "verified", "vetted", "background check", "trust score", or similar unless a commit literally introduces such a thing (it will not). A feature named "Trust", "Directory", or similar is peer/social information only; describe it plainly, never as verification.\n- Never invent numbers or specifics: no member counts, dollar amounts, dates, percentages, ratings, or "over N days" claims unless the exact figure appears in a commit. When you are unsure what a feature does, say less — a vaguer true sentence beats a specific false one, and it is always acceptable to omit a change you cannot describe accurately.\n- Do not name a plugin or feature you cannot ground in a commit. Do not combine two unrelated commits into one invented capability.\n\nBRAND VOICE:\n${brandVoice}\n\nWRITING RULES (these override any instinct toward marketing copy):\n- Write at about a 6th-grade reading level. Short sentences. Everyday words. If a 12-year-old would stumble on a word, pick a simpler one.\n- Sound like one person talking to a friend, not a company announcing. This is built and run by a single operator, not a team or a company — so "we", "our", and "us" for the work are never allowed; they are always wrong here ("we've made it possible", "our new feature" are banned). Prefer to avoid first person altogether: lead with what changed and what "you" (the reader) can do — "Added X. You can now…" reads better than "I added X". Use a singular "I" only when dropping it makes the sentence clumsy. Order of preference: a clean person-free sentence first, a singular "I" as the fallback, and "we" never.\n- Never sell the importance of a change. State what it does and move on. Banned: "matters deeply", "build trust", "deserve", "we're committed", "game-changer", "powerful", "seamless", "low-friction", and any sentence about what the feature "says about us".\n- No negative framing. Don't describe how bad things were before, don't use words like "disrespectful", "broken promises", or "pain". Just say what's new and how to use it.\n- No rhetorical questions ("Why does this matter?"). No applause lines. No closing flourish.\n- Don't perform kindness. Never tell readers what they deserve, what they feel, or what is hard for them ("we know that... feels", "you shouldn't have to") — guessing at someone's feelings is condescending even when it sounds warm. Warmth comes from being useful and plain, not from declaring that you care.\n- Don't praise yourself for caring or working. No "we read every report. We investigate. We fix." cadence, no listing your own virtues, no casting the builder as anyone's rescuer. Readers are capable adults; write to them as equals.\n- It's fine for an update to be small and to read small. Two honest paragraphs beat five inflated ones. If the window holds only minor fixes, a short "fixed a few things this week" update is the correct, honest output.\n- The project's code lives at exactly this URL: ${repoUrl} — when mentioning GitHub, use that URL verbatim. Never shorten, rename, or guess it.\n\nToday: ${today}`,
    messages: [
      {
        role: 'user',
        content: `Recent changes merged to main, each as its commit subject followed by its full message body (the body is the real description of what changed — rely on it, not just the subject):\n\n${commits}\n\nWrite about ONLY these changes, and only what the text above actually states (re-read the GROUNDING rules). Return ONLY a JSON object with these exact keys:\n- feedTitle: In-app announcement title (max 80 chars, plain language). Describe the actual changes; do not call something a launch unless a commit adds it for the first time.\n- feedBody: 2-3 sentence in-app announcement. Calm, plain, no jargon. Only claims grounded in the commits above.\n- wikiPageName: Wiki page filename. Format: Product-Update-${today}-Short-Title (hyphens only, no spaces, no special chars)\n- wikiContent: Full markdown page. Include ## What Shipped and ## Why It Matters sections. Every line traceable to a commit above.\n- wikiSiteExcerpt: One sentence summary for the content index (max 150 chars)\n- quoraDraft: 2-4 short paragraph Quora post in a plain, personal tone. Written by a single operator: never use "we", "our", or "us". Prefer to avoid first person where it still reads cleanly (talk about what changed and what you, the reader, can do); use a singular "I" only when avoiding it would read awkwardly. Plain words, ~6th-grade reading level. Say what changed and how a reader uses it — grounded strictly in the commits above, inventing no capability, number, or launch claim — and one sentence on where the project lives, giving the GitHub URL exactly as ${repoUrl} (do not alter or abbreviate it). Do not sell its importance, do not describe past frustrations, no rhetorical questions. If the window is only small fixes, it is correct for this to be a short, modest post.\n\nReturn ONLY valid JSON. No markdown fences. No preamble.`,
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
