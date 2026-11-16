import { describe, expect, it } from 'vitest';
import {
  CLICK_LOG_SCHEME_TAGS,
  MAX_TAGS_PER_KIND,
  NOT_LISTED_SCHEME_SLUG,
  SE_CLICK_LOG_WORDS as W,
  clickLogCreateBody,
  clickLogLocationLabel,
  clickLogMatchTags,
  clickLogPickedTags,
  clickLogSchemeOptions,
  clickLogSubmitDisabled,
  clickLogToggleTag,
} from '@ctf/shared';
import { isValidProblemTag, isValidSchemeTag } from './tags';

// The rules behind the 3.1 "Log what happened" sheet (web and Android), which must match the 3.0
// ClickLog form and the POST /api/click-log checks.

const base = { submitting: false, problemTags: [] as string[], schemeTags: [] as string[], locationAdded: false, suggestion: '' };

describe('clickLogSubmitDisabled', () => {
  it('allows an untagged entry with nothing else filled in', () => {
    expect(clickLogSubmitDisabled(base)).toBe(false);
  });
  it('waits while sending', () => {
    expect(clickLogSubmitDisabled({ ...base, submitting: true })).toBe(true);
  });
  it('waits for a location once a tag is picked', () => {
    expect(clickLogSubmitDisabled({ ...base, problemTags: ['drones'] })).toBe(true);
    expect(clickLogSubmitDisabled({ ...base, problemTags: ['drones'], locationAdded: true })).toBe(false);
  });
  it('waits for the description when "Not listed" is picked', () => {
    const notListed = { ...base, schemeTags: [NOT_LISTED_SCHEME_SLUG], locationAdded: true };
    expect(clickLogSubmitDisabled({ ...notListed, suggestion: '   ' })).toBe(true);
    expect(clickLogSubmitDisabled({ ...notListed, suggestion: 'They did this' })).toBe(false);
  });
});

describe('clickLogCreateBody', () => {
  const fields = { location: {}, note: 'n', sharedWithOwner: false, problemTags: [] as string[], schemeTags: [] as string[], schemeSuggestion: ' s ', schemeQuoraUrl: ' https://www.quora.com/x ' };
  it('sends the note and choice, and leaves out unpicked tags and the suggestion', () => {
    expect(clickLogCreateBody(fields)).toEqual({ metadata: { notes: 'n' }, sharedWithOwner: false });
  });
  it('shares a tagged entry and carries its location', () => {
    const body = clickLogCreateBody({ ...fields, location: { latitude: 1, longitude: 2 }, problemTags: ['drones'] });
    expect(body).toEqual({ metadata: { latitude: 1, longitude: 2, notes: 'n' }, sharedWithOwner: true, problemTags: ['drones'] });
  });
  it('sends the trimmed suggestion only with "Not listed"', () => {
    const body = clickLogCreateBody({ ...fields, schemeTags: [NOT_LISTED_SCHEME_SLUG] });
    expect(body.schemeSuggestion).toBe('s');
    expect(body.schemeQuoraUrl).toBe('https://www.quora.com/x');
  });
});

describe('tags', () => {
  it('adds up to the cap and removes a picked tag', () => {
    const full = Array.from({ length: MAX_TAGS_PER_KIND }, (_, i) => `t${i}`);
    expect(clickLogToggleTag(full, 'new')).toEqual(full);
    expect(clickLogToggleTag(['a', 'b'], 'a')).toEqual(['b']);
    expect(clickLogToggleTag(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('matches by label, ignoring case and spaces', () => {
    const options = [{ slug: 'a', label: 'Drones hovering' }, { slug: 'b', label: 'Cars' }];
    expect(clickLogMatchTags(options, '  DRONE ')).toEqual([options[0]]);
    expect(clickLogMatchTags(options, '')).toBe(options);
    expect(clickLogPickedTags(options, ['b', 'gone'])).toEqual([options[1]]);
  });
  it('offers "Not listed" only to a member who may suggest a scheme', () => {
    expect(clickLogSchemeOptions(true)).toBe(CLICK_LOG_SCHEME_TAGS);
    expect(clickLogSchemeOptions(false).some((tag) => tag.slug === NOT_LISTED_SCHEME_SLUG)).toBe(false);
  });
  it('keeps the server validators reading the shared lists', () => {
    expect(isValidProblemTag('drones')).toBe(true);
    expect(isValidSchemeTag(NOT_LISTED_SCHEME_SLUG)).toBe(true);
    expect(isValidSchemeTag('no-such-scheme')).toBe(false);
  });
});

describe('clickLogLocationLabel', () => {
  it('names each state of the location button', () => {
    expect(clickLogLocationLabel(false, false)).toBe(W.addLocation);
    expect(clickLogLocationLabel(false, true)).toBe(W.locating);
    expect(clickLogLocationLabel(true, false)).toBe(W.locationAdded);
  });
});
