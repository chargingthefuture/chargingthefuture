import { describe, expect, it } from 'vitest';
import { CLICK_LOG_PROBLEM_TAGS, CLICK_LOG_SCHEME_TAGS } from './tags';
import {
  CLICK_LOG_PROBLEM_CATEGORIES,
  CLICK_LOG_PROBLEM_TAG_CATEGORY,
  CLICK_LOG_SCHEME_KIND_LABEL,
  CLICK_LOG_SCHEME_TAG_KIND,
  problemCategoryFor,
  problemCategorySlugMap,
  schemeKindFor,
} from './tag-categories';

// The groupings are only useful if they are complete. A problem slug with no category silently
// disappears from the category rollup in the report, and a category listing a slug that no longer
// exists silently counts nothing — both would leave a reader with numbers that do not add up and
// no sign anything is wrong. These tests fail instead, in both directions, whenever a tag is added
// to `tags.ts` without being placed.
describe('ClickLog problem categories', () => {
  it('places every problem tag in exactly one category', () => {
    const unplaced = CLICK_LOG_PROBLEM_TAGS.filter((tag) => !CLICK_LOG_PROBLEM_TAG_CATEGORY[tag.slug]);
    expect(unplaced.map((tag) => tag.slug)).toEqual([]);
  });

  it('has no category entry for a tag that does not exist', () => {
    const known = new Set(CLICK_LOG_PROBLEM_TAGS.map((tag) => tag.slug));
    const unknown = Object.keys(CLICK_LOG_PROBLEM_TAG_CATEGORY).filter((slug) => !known.has(slug));
    expect(unknown).toEqual([]);
  });

  it('only names categories that are defined', () => {
    const defined = new Set(CLICK_LOG_PROBLEM_CATEGORIES.map((category) => category.slug));
    const undefinedCategories = Object.values(CLICK_LOG_PROBLEM_TAG_CATEGORY).filter(
      (slug) => !defined.has(slug)
    );
    expect(undefinedCategories).toEqual([]);
  });

  it('leaves no category empty', () => {
    const map = problemCategorySlugMap();
    const empty = CLICK_LOG_PROBLEM_CATEGORIES.filter((category) => map[category.slug].length === 0);
    expect(empty.map((category) => category.slug)).toEqual([]);
  });

  it('resolves a tag to its category object', () => {
    expect(problemCategoryFor('tinnitus')?.slug).toBe('body-and-health');
    expect(problemCategoryFor('not-a-real-tag')).toBeNull();
  });

  it('accounts for every tag exactly once across the slug map', () => {
    const map = problemCategorySlugMap();
    const total = Object.values(map).reduce((sum, slugs) => sum + slugs.length, 0);
    expect(total).toBe(CLICK_LOG_PROBLEM_TAGS.length);
  });
});

describe('ClickLog scheme kinds', () => {
  it('classifies every scheme tag', () => {
    const unclassified = CLICK_LOG_SCHEME_TAGS.filter((tag) => !CLICK_LOG_SCHEME_TAG_KIND[tag.slug]);
    expect(unclassified.map((tag) => tag.slug)).toEqual([]);
  });

  it('has no kind entry for a scheme that does not exist', () => {
    const known = new Set(CLICK_LOG_SCHEME_TAGS.map((tag) => tag.slug));
    const unknown = Object.keys(CLICK_LOG_SCHEME_TAG_KIND).filter((slug) => !known.has(slug));
    expect(unknown).toEqual([]);
  });

  it('keeps the split named in the tags.ts taxonomy note', () => {
    // The four the note calls ambient, and one it calls an operation — if these ever flip, the
    // report starts telling a reader a continuous condition and a single operation are the same
    // kind of thing, which is the exact confusion the note warns about.
    expect(schemeKindFor('color-sensitization')).toBe('ambient');
    expect(schemeKindFor('road-sensitization')).toBe('ambient');
    expect(schemeKindFor('thats-a-nice')).toBe('ambient');
    expect(schemeKindFor('staged-narratives')).toBe('ambient');
    expect(schemeKindFor('performed-kindness')).toBe('pattern');
    expect(schemeKindFor('poisoned-well')).toBe('operation');
  });

  it('gives every kind a label and falls back for an unknown slug', () => {
    for (const kind of Object.values(CLICK_LOG_SCHEME_TAG_KIND)) {
      expect(CLICK_LOG_SCHEME_KIND_LABEL[kind]).toBeTruthy();
    }
    expect(schemeKindFor('not-a-real-scheme')).toBe('unclassified');
  });
});
