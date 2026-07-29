#!/usr/bin/env node
/**
 * Weekly community-activity draft generator.
 *
 * Sibling of generate-update.mjs. Where that one turns recent commits into a
 * product-update post, this one turns privacy-safe, aggregate plugin activity
 * into a short Quora draft: how many open SocketRelay posts are waiting for
 * help, how many Directory profiles exist, which skills are represented. The
 * point is to show real need and real activity so newcomers see a reason to
 * join — without ever exposing an individual person, post, or profile.
 *
 * Reads:  DATABASE_URL, ANTHROPIC_API_KEY (env vars)
 * Writes: JSON to stdout — { title, quoraDraft, statsMarkdown }
 *
 * PRIVACY: every query here returns COUNTS and taxonomy names only. No user id,
 * name, handle, free text, or row-level detail is ever selected. Personal /
 * health surfaces (Mood, GentlePulse, ClickLog) are intentionally NOT counted —
 * advertising activity there would be surveillance of vulnerable use, not a
 * marketplace signal, so they are excluded by design.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    console.error(`${name} is required.`);
    process.exit(1);
  }
  return value;
}

const databaseUrl = requireEnv('DATABASE_URL');
requireEnv('ANTHROPIC_API_KEY');

// The number of documented skills a fully working Skills Economy needs. Reaching all 650 is the
// baseline for that full economy — one we size at about $300 billion in community value (the same
// $300B goal the GDP plugin tracks; an estimate, never money or price). The Directory shows how many
// skills are documented so far, so the draft can report that count against this 650 baseline as a
// percentage.
const FULL_ECONOMY_SKILL_BASELINE = 650;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

/**
 * The per-plugin stat registry. To advertise a new plugin's activity, add an
 * entry: a slug, a display name, and a `collect(client)` that returns an array
 * of { label, value } facts. Keep every query aggregate-only (COUNT / DISTINCT
 * / taxonomy names) so nothing about an individual is ever exposed. A query
 * that throws is skipped with a note rather than failing the whole draft, so a
 * missing table on a legacy database can't block the post.
 *
 * SocketRelay and Directory are the two flagship signals; ServiceCredits adds
 * the community-currency signal. Other marketplace plugins (LightHouse,
 * Foundation, TrustTransport, Workforce) are easy follow-ups — add them the
 * same way once their headline count is chosen.
 */
const STAT_PROVIDERS = [
  {
    slug: 'socket-relay',
    displayName: 'SocketRelay',
    async collect(client) {
      const open = await client.query(
        `SELECT COUNT(*)::int AS n FROM socket_relay_requests WHERE status = 'open'`,
      );
      const fulfilledThisWeek = await client.query(
        `SELECT COUNT(*)::int AS n FROM socket_relay_requests
         WHERE status = 'fulfilled' AND updated_at >= NOW() - INTERVAL '7 days'`,
      );
      return [
        { label: 'open posts waiting for someone to help', value: open.rows[0].n },
        { label: 'posts marked fulfilled in the last 7 days', value: fulfilledThisWeek.rows[0].n },
      ];
    },
  },
  {
    slug: 'directory',
    displayName: 'Directory',
    async collect(client) {
      // directory_profiles.id is varchar on the production (v2-cloned) database
      // while directory_profile_skills.profile_id is uuid, so every join across
      // the two must cast both sides to text (see repository.ts, PR #534).
      const profiles = await client.query(
        `SELECT COUNT(*)::int AS n FROM directory_profiles
         WHERE is_active = TRUE AND deleted_at IS NULL`,
      );
      const distinctSkills = await client.query(
        `SELECT COUNT(DISTINCT dps.skill_id)::int AS n
         FROM directory_profile_skills dps
         JOIN directory_profiles p ON dps.profile_id::text = p.id::text
         WHERE p.is_active = TRUE AND p.deleted_at IS NULL`,
      );
      const totalSkills = await client.query(
        `SELECT COUNT(*)::int AS n FROM skills_taxonomy_skills WHERE is_active = TRUE`,
      );
      const topSkills = await client.query(
        `SELECT s.name AS name, COUNT(*)::int AS n
         FROM directory_profile_skills dps
         JOIN directory_profiles p ON dps.profile_id::text = p.id::text
         JOIN skills_taxonomy_skills s ON s.id = dps.skill_id
         WHERE p.is_active = TRUE AND p.deleted_at IS NULL AND s.is_active = TRUE
         GROUP BY s.name
         ORDER BY n DESC, s.name ASC
         LIMIT 5`,
      );
      // How many skills are documented so far, measured against the 650 a full Skills Economy
      // needs. The percentage is whole-number and can read small early on — that is fine to show
      // plainly.
      const documentedNow = totalSkills.rows[0].n;
      const pctOfBaseline = Math.round((documentedNow / FULL_ECONOMY_SKILL_BASELINE) * 100);
      const facts = [
        { label: 'people listed in the Directory', value: profiles.rows[0].n },
        { label: 'different skills people have listed', value: distinctSkills.rows[0].n },
        { label: 'skills available to pick from in total', value: totalSkills.rows[0].n },
        {
          label: 'documented skills toward an economy',
          value: `${documentedNow} of ${FULL_ECONOMY_SKILL_BASELINE} (${pctOfBaseline}%) — all ${FULL_ECONOMY_SKILL_BASELINE} would be about $300 billion in community value`,
        },
      ];
      if (topSkills.rows.length > 0) {
        const named = topSkills.rows.map((r) => `${r.name} (${r.n})`).join(', ');
        facts.push({ label: 'most listed skills right now', value: named });
      }
      return facts;
    },
  },
  {
    slug: 'service-credits',
    displayName: 'ServiceCredits',
    async collect(client) {
      // ServiceCredits is the community's internal currency. Every query here is a
      // whole-community aggregate — a count of wallets, the total members are holding, and how
      // many balances moved this week. No individual wallet, balance, or transfer is exposed.
      const holders = await client.query(
        `SELECT COUNT(*)::int AS n FROM service_credits_wallets WHERE available_balance > 0`,
      );
      // It is mutual credit, so balances can go negative and the system nets to about zero — a
      // raw SUM would read as ~0. Sum only the positive balances to show what members are holding.
      const held = await client.query(
        `SELECT COALESCE(SUM(GREATEST(available_balance, 0)), 0)::int AS n FROM service_credits_wallets`,
      );
      const activeThisWeek = await client.query(
        `SELECT COUNT(*)::int AS n FROM service_credits_wallets
         WHERE updated_at >= NOW() - INTERVAL '7 days'`,
      );
      return [
        { label: 'members holding ServiceCredits', value: holders.rows[0].n },
        { label: 'ServiceCredits members are holding right now', value: held.rows[0].n },
        { label: 'members whose ServiceCredits balance changed in the last 7 days', value: activeThisWeek.rows[0].n },
      ];
    },
  },
];

async function collectStats() {
  const client = await pool.connect();
  const out = [];
  try {
    for (const provider of STAT_PROVIDERS) {
      try {
        const facts = await provider.collect(client);
        out.push({ slug: provider.slug, displayName: provider.displayName, facts });
      } catch (err) {
        out.push({
          slug: provider.slug,
          displayName: provider.displayName,
          facts: [],
          note: `skipped — ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  return out;
}

// The public, signed-out landing page for each plugin. A reader with no account can open these,
// see what the app does, and sign in — so they are safe to paste into a public Quora post. The path
// is always /apps/<slug> (see ctf/packages/web/lib/plugins/repository.ts getPluginRoute).
const APP_BASE_URL = 'https://app.chargingthefuture.com';
function appUrlFor(slug) {
  return `${APP_BASE_URL}/apps/${slug}`;
}

function toStatsMarkdown(stats) {
  const lines = [];
  for (const plugin of stats) {
    lines.push(`### ${plugin.displayName} — ${appUrlFor(plugin.slug)}`);
    if (plugin.note) {
      lines.push(`- _${plugin.note}_`);
    }
    for (const fact of plugin.facts) {
      lines.push(`- ${fact.label}: **${fact.value}**`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function toStatsForPrompt(stats) {
  const lines = [];
  for (const plugin of stats) {
    if (plugin.facts.length === 0) continue;
    // Give the model the exact direct link for this app so it can paste it verbatim after the app's
    // name — never a guessed or shortened URL.
    lines.push(`${plugin.displayName} (direct link: ${appUrlFor(plugin.slug)}):`);
    for (const fact of plugin.facts) {
      lines.push(`  - ${fact.label}: ${fact.value}`);
    }
  }
  return lines.join('\n');
}

const stats = await collectStats();
const statsMarkdown = toStatsMarkdown(stats);
const statsForPrompt = toStatsForPrompt(stats);

if (statsForPrompt.trim().length === 0) {
  console.error('No stats could be collected — every provider was skipped.');
  process.exit(1);
}

const brandVoice = readFileSync(
  join(repoRoot, 'ctf/docs/BRAND_VOICE_LEXICON.md'),
  'utf-8',
).slice(0, 3000);

const repoUrl = 'https://github.com/chargingthefuture/chargingthefuture';
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
    system: `You write short weekly community notes for Charging the Future, an open-source platform built for survivors of Specterati harassment. Follow the brand voice guide carefully.\n\nBRAND VOICE:\n${brandVoice}\n\nWHAT THIS POST IS:\nA plain, honest weekly snapshot of how much is happening on the platform, using only whole-community totals. The goal is to show real activity and real need so someone reading sees a reason to join: open requests are waiting for help, people have listed skills, a skill they have is needed. Never describe any single person, post, or profile — only the totals you are given.\n\nWRITING RULES (these override any instinct toward marketing copy):\n- Write at about a 6th-grade reading level. Short sentences. Everyday words. If a 12-year-old would stumble on a word, pick a simpler one.\n- Sound like one person talking to a friend, not a company announcing. First person ("this week", "you can") over corporate "we are proud".\n- Use ONLY the numbers given below. Never invent, round up, or guess a number. If a number is 0, say it plainly.\n- A count of posts, requests, or items is a count of THINGS, not people. The same person can create several posts, so these totals are cumulative activity, not a headcount. Never say or imply how many people are behind them (do not turn "2 open posts" into "2 people"). Only call a number people or members when the fact is explicitly labeled "people" or "members".\n- Each app is given with its exact direct link ("direct link: https://app.chargingthefuture.com/apps/..."). The FIRST time you mention an app by name, put its full link right after the name, in parentheses, copied EXACTLY as given. Never invent, shorten, or guess a link, and never link an app you have no link for.\n- Never sell the importance of the numbers. State what they are and what someone can do, then stop. Banned: "matters deeply", "build trust", "deserve", "we're committed", "game-changer", "powerful", "seamless", "thriving", "vibrant", and any sentence about what the numbers "say about us".\n- No negative framing. Don't shame low numbers or hype high ones. A small number is fine to read small.\n- No rhetorical questions. No applause lines. No closing flourish.\n- Don't perform kindness or guess at anyone's feelings. Warmth comes from being useful and plain.\n- The project's code lives at exactly this URL: ${repoUrl} — use it verbatim when mentioning where to find the project.\n\nToday: ${today}`,
    messages: [
      {
        role: 'user',
        content: `This week's whole-community totals:\n\n${statsForPrompt}\n\nWrite a community snapshot. Return ONLY a JSON object with these exact keys:\n- title: A short, plain in-list title (max 80 chars), e.g. "Community activity — ${today}".\n- quoraDraft: A 2-4 short-paragraph Quora post, written like a personal note. Lead with the SocketRelay open posts and the Directory numbers, since those show need most clearly. Work in the skills-documented-so-far line — how many of the 650 skills an economy needs are documented now, and the percentage — since it shows how the economy is filling in; use only the exact numbers given for it. When you first name each app, paste its exact direct link (given above as "direct link: ...") right after the name in parentheses, so a reader can tap straight through to it. Remember an open-post count is a count of posts, not people. Plain words, ~6th-grade reading level. Make it concrete: a number, what it means, and one simple thing a reader can do (join, list a skill, answer an open post). One sentence on where the project lives, giving the GitHub URL exactly as ${repoUrl}. Do not invent numbers or links, do not sell importance, no rhetorical questions.\n\nReturn ONLY valid JSON. No markdown fences. No preamble.`,
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

function stripCodeFences(text) {
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : text;
}

const content = stripCodeFences(rawContent);

let parsed;
try {
  parsed = JSON.parse(content);
} catch {
  console.error('Model returned invalid JSON:\n', rawContent);
  process.exit(1);
}

// Attach the raw source numbers so the draft issue shows both the post and the
// totals it was written from — the owner can sanity-check before posting.
parsed.statsMarkdown = statsMarkdown;

process.stdout.write(JSON.stringify(parsed) + '\n');
