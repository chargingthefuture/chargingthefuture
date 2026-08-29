// Neutral helpers for normalizing skills-taxonomy names (sector / occupation / skill labels).
// Lives on its own — independent of any data source — so the taxonomy change apply engine and the
// proposal pipeline can normalize names the same way.

// Trim and collapse internal whitespace to a single space. Used to match names against the live
// taxonomy (e.g. looking a sector up by name) and to compute the lowercase key for dedupe/match.
export function normalizeTaxonomyName(value) {
  return value.trim().replace(/\s+/g, ' ');
}

// --- Plural-twin detection -------------------------------------------------
//
// Why this exists: the taxonomy has twice grown a singular occupation alongside a pre-existing
// plural one - "Marketing Specialist" next to "Marketing Specialists" (cleaned up by changes 1 and
// 26-34) and "Photographer" next to "Photographers / Videographers" (changes 68-76). Each time, the
// two rows split one role's holders in half: Workforce and the Directory match a member through the
// occupation their skill hangs from, so somebody listed under one twin is invisible to a search of
// the other, and neither row shows the real capacity. Each cleanup cost nine changes.
//
// The change list's static check cannot catch this. It only sees what the list itself declares -
// the live rows are in the database, not the repo - so a change adding a twin of a live occupation
// validates cleanly and only goes wrong at apply time. Hence the check lives in the apply engine,
// which does see the live rows.
//
// What counts as a twin: two occupation names in the SAME sector that name at least one role in
// common, comparing singular forms. A name is split on "/" into segments, because the live
// convention writes compound occupations that way ("Photographers / Videographers",
// "Software Engineers / Developers"), and it was exactly such a compound that hid the last twin
// from a whole-string comparison. Parenthetical glosses are dropped ("Plumbers (construction)" is
// a plumber).
//
// Deliberately imperfect, in the safe direction. "Graphic / Visual Designers" yields the tokens
// "graphic" and "visual designer", so a later "Graphic Designers" would NOT be flagged - the split
// cannot know the first segment is short for "Graphic Designers". The check is a net for the
// obvious case, not a proof; it is better to miss one than to block a legitimate add on a guess.

// Strip a plural suffix from one role token. Ordinary English rules, no dictionary: enough to make
// "specialists"/"specialist" and "photographers"/"photographer" compare equal.
function singularizeRoleToken(token) {
  if (token.length > 3 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && /(?:s|x|z|ch|sh)es$/.test(token)) return token.slice(0, -2);
  if (token.endsWith('ss')) return token;
  if (token.length > 1 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

// The set of singular role names an occupation label refers to.
export function occupationRoleTokens(name) {
  return normalizeTaxonomyName(String(name ?? ''))
    .split('/')
    .map((segment) => segment.replace(/\([^)]*\)/g, ' '))
    .map((segment) => normalizeTaxonomyName(segment).toLowerCase())
    .filter((segment) => segment.length > 0)
    .map(singularizeRoleToken);
}

// True when two occupation names in the same sector name a role in common while not being the same
// label. An exact match is not a twin - that is the ordinary "already exists" case the apply engine
// handles as a no-op.
export function isPluralTwin(candidateName, liveName) {
  const candidate = normalizeTaxonomyName(String(candidateName ?? '')).toLowerCase();
  const live = normalizeTaxonomyName(String(liveName ?? '')).toLowerCase();
  if (candidate.length === 0 || live.length === 0 || candidate === live) return false;
  const liveTokens = new Set(occupationRoleTokens(liveName));
  return occupationRoleTokens(candidateName).some((token) => liveTokens.has(token));
}
