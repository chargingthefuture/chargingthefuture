import { describe, expect, it } from 'vitest';
import { commentStateForAuthor, isPubliclyVisible, isVisibleToAuthor, mayExportToBlog } from './visibility';

describe('isPubliclyVisible', () => {
  it('shows a visible comment from an approved author', () => {
    expect(isPubliclyVisible({ status: 'visible', authorIsApproved: true })).toBe(true);
  });

  it('hides a comment while its author is not approved', () => {
    expect(isPubliclyVisible({ status: 'visible', authorIsApproved: false })).toBe(false);
  });

  // The two halves are separate on purpose: approving somebody must not resurrect a comment an
  // admin took down, and a removal must not read as a verification problem.
  it('keeps a removed comment hidden even once the author is approved', () => {
    expect(isPubliclyVisible({ status: 'removed', authorIsApproved: true })).toBe(false);
  });

  it('keeps a withdrawn comment hidden even once the author is approved', () => {
    expect(isPubliclyVisible({ status: 'withdrawn', authorIsApproved: true })).toBe(false);
  });
});

describe('isVisibleToAuthor', () => {
  it('shows somebody their own comment', () => {
    expect(isVisibleToAuthor({ authorUserId: 'u1', viewerUserId: 'u1' })).toBe(true);
  });

  it('does not show it to anybody else', () => {
    expect(isVisibleToAuthor({ authorUserId: 'u1', viewerUserId: 'u2' })).toBe(false);
  });

  it('does not show it to a signed-out reader', () => {
    expect(isVisibleToAuthor({ authorUserId: 'u1', viewerUserId: null })).toBe(false);
  });
});

describe('commentStateForAuthor', () => {
  it('reads as held while the author waits on approval', () => {
    expect(commentStateForAuthor({ status: 'visible', authorIsApproved: false })).toBe('held_for_approval');
  });

  it('reads as live once they are approved', () => {
    expect(commentStateForAuthor({ status: 'visible', authorIsApproved: true })).toBe('live');
  });

  // A removed comment says removed whether or not the person is approved — otherwise an unapproved
  // author whose comment was taken down would be told it is merely waiting, which is not true.
  it('reads as removed regardless of approval', () => {
    expect(commentStateForAuthor({ status: 'removed', authorIsApproved: false })).toBe('removed');
    expect(commentStateForAuthor({ status: 'removed', authorIsApproved: true })).toBe('removed');
  });

  it('reads as withdrawn when the author took it down themselves', () => {
    expect(commentStateForAuthor({ status: 'withdrawn', authorIsApproved: true })).toBe('withdrawn');
  });
});

describe('mayExportToBlog', () => {
  it('exports only what the author asked to have exported', () => {
    expect(mayExportToBlog({ status: 'visible', authorIsApproved: true, exportOptIn: true })).toBe(true);
    expect(mayExportToBlog({ status: 'visible', authorIsApproved: true, exportOptIn: false })).toBe(false);
  });

  // Export puts the text somewhere it cannot be withdrawn from, so everything that hides a comment
  // from the public also keeps it out of the build.
  it('never exports a comment the public cannot already see', () => {
    expect(mayExportToBlog({ status: 'visible', authorIsApproved: false, exportOptIn: true })).toBe(false);
    expect(mayExportToBlog({ status: 'removed', authorIsApproved: true, exportOptIn: true })).toBe(false);
    expect(mayExportToBlog({ status: 'withdrawn', authorIsApproved: true, exportOptIn: true })).toBe(false);
  });
});
