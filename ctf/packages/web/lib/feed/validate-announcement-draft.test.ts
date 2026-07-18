import { describe, it, expect } from 'vitest';
import { validateAnnouncementDraftInput } from './repository';

// Regression guard: the shipped admin authoring UI has no targeting control and posts drafts
// without a `targeting` field. A change that made targeting mandatory here broke every Create-draft
// with "Invalid announcement draft payload". Targeting must stay optional (omitted = broadcast to
// all), while a supplied non-object targeting is still rejected.
describe('validateAnnouncementDraftInput', () => {
  const base = { title: 'Title', body: 'Body', scheduleAtIso: null, expiresAtIso: null };

  it('accepts a draft with no targeting field (the shipped admin UI payload)', () => {
    expect(validateAnnouncementDraftInput({ ...base })).toBe(true);
  });

  it('accepts a draft with an explicit targeting object', () => {
    expect(validateAnnouncementDraftInput({ ...base, targeting: { roles: ['member'] } })).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(validateAnnouncementDraftInput({ ...base, title: '   ' })).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(validateAnnouncementDraftInput({ ...base, body: '' })).toBe(false);
  });

  it('rejects a non-object targeting value', () => {
    // A string/array is not valid targeting; cast through unknown since the type expects an object.
    expect(
      validateAnnouncementDraftInput({ ...base, targeting: 'everyone' as unknown as undefined }),
    ).toBe(false);
    expect(
      validateAnnouncementDraftInput({ ...base, targeting: [] as unknown as undefined }),
    ).toBe(false);
  });
});
