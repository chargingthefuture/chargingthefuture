// ClickLog tag validation for the server and the 3.0 page. The tag lists themselves, and the
// rules for adding to them (never rename or delete a slug), live in
// ctf/packages/shared/src/click-log/tags.ts so the 3.1 sheet on web and Android offers the same
// tags; they are re-exported here so existing imports keep working.

import { CLICK_LOG_PROBLEM_TAGS, CLICK_LOG_SCHEME_TAGS } from '@ctf/shared';

export { CLICK_LOG_PROBLEM_TAGS, CLICK_LOG_SCHEME_TAGS, NOT_LISTED_SCHEME_SLUG, type ClickLogTag } from '@ctf/shared';

const PROBLEM_SLUGS = new Set(CLICK_LOG_PROBLEM_TAGS.map((t) => t.slug));
const SCHEME_SLUGS = new Set(CLICK_LOG_SCHEME_TAGS.map((t) => t.slug));

export function isValidProblemTag(slug: string): boolean {
  return PROBLEM_SLUGS.has(slug);
}

export function isValidSchemeTag(slug: string): boolean {
  return SCHEME_SLUGS.has(slug);
}

export function problemTagLabel(slug: string): string {
  return CLICK_LOG_PROBLEM_TAGS.find((t) => t.slug === slug)?.label ?? slug;
}

export function schemeTagLabel(slug: string): string {
  return CLICK_LOG_SCHEME_TAGS.find((t) => t.slug === slug)?.label ?? slug;
}
