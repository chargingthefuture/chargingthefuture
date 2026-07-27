// Concierge resolver — turns a member's free-text message into the best-matching feature(s).
//
// Deliberately deterministic and narrow. It returns at most `CONCIERGE_MAX_MATCHES` features, ranked,
// and only when the text clearly signals one — so the home chat points a member at the one right
// place instead of a wall of apps (owner principle: "saying every app solves a problem is incorrect
// and overwhelming"). When nothing clears the bar it returns an empty list, and the caller falls back
// to the community / ask-a-person path rather than guessing.

import { CONCIERGE_INTENTS, type ConciergeIntent } from './intents';

export type ConciergeMatch = {
  slug: string;
  name: string;
  blurb: string;
  // Relative score (higher = stronger signal); for ordering/telemetry, not shown to members.
  score: number;
};

// Show at most this many routes. One is ideal; a second is allowed only when it scores close to the
// top, so the member still sees a short, decisive answer.
export const CONCIERGE_MAX_MATCHES = 2;

// Minimum score for a match to count at all. A single single-word hit (score 1) is enough to surface
// a route, but see `isCloseRunnerUp` for when a second route is allowed alongside the top one.
const MIN_SCORE = 1;

// Normalize for matching: lowercase, unify curly quotes/dashes with straight ones, collapse
// whitespace. Keeps keyword authoring forgiving (e.g. "can't" vs "can’t").
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Word-boundary test for single-word keywords so "job" doesn't match "jobless" by accident, while
// phrase keywords ("lost my job") use plain substring containment.
function matchesKeyword(haystack: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    return haystack.includes(keyword);
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

function scoreIntent(haystack: string, intent: ConciergeIntent): number {
  let score = 0;
  for (const keyword of intent.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (!matchesKeyword(haystack, normalizedKeyword)) {
      continue;
    }
    // Multi-word phrases are a much stronger signal than a single shared word.
    score += normalizedKeyword.includes(' ') ? 2 : 1;
  }
  return score;
}

// A second route rides along only if it's within this fraction of the top score — keeps the answer
// short and decisive rather than listing near-misses.
function isCloseRunnerUp(topScore: number, score: number): boolean {
  return score >= MIN_SCORE && score >= topScore * 0.6;
}

// Resolve free text to the best feature route(s). Empty array = no confident match; the caller should
// fall back (community post / ask the AI Assistant) rather than route arbitrarily.
export function resolveConcierge(text: string): ConciergeMatch[] {
  const haystack = normalize(text ?? '');
  if (haystack.length === 0) {
    return [];
  }

  const scored: ConciergeMatch[] = [];
  for (const intent of CONCIERGE_INTENTS) {
    const score = scoreIntent(haystack, intent);
    if (score >= MIN_SCORE) {
      scored.push({ slug: intent.slug, name: intent.name, blurb: intent.blurb, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return [];
  }

  const topScore = scored[0].score;
  return scored.filter((m, index) => index === 0 || isCloseRunnerUp(topScore, m.score)).slice(0, CONCIERGE_MAX_MATCHES);
}

// Featured starters for the empty home chat — empowerment-forward (get a place, work, a ride,
// connection, a repair), per the reframe (2026-06-17): lead with getting-needs-met, not with
// "log it" or "breathe". ClickLog / Mood are still resolvable when someone explicitly
// asks for them, but they are not featured as starters.
const FEATURED_STARTER_SLUGS = ['lighthouse', 'workforce', 'trust-transport', 'chyme', 'directory'];

// The example questions for tappable starter prompts on an empty home chat (the one-tap "ask" path).
export function conciergeStarterPrompts(limit = 5): string[] {
  const bySlug = new Map(CONCIERGE_INTENTS.map((intent) => [intent.slug, intent.starter]));
  const featured = FEATURED_STARTER_SLUGS
    .map((slug) => bySlug.get(slug))
    .filter((starter): starter is string => typeof starter === 'string');
  return featured.slice(0, limit);
}
