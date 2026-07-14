// Neutral helpers for normalizing skills-taxonomy names (sector / occupation / skill labels).
// Lives on its own — independent of any data source — so the taxonomy change apply engine and the
// proposal pipeline can normalize names the same way.

// Trim and collapse internal whitespace to a single space. Used to match names against the live
// taxonomy (e.g. looking a sector up by name) and to compute the lowercase key for dedupe/match.
export function normalizeTaxonomyName(value) {
  return value.trim().replace(/\s+/g, ' ');
}
