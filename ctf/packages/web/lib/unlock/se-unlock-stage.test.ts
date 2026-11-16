import { describe, expect, it } from 'vitest';
import { seUnlockStage } from '@ctf/shared';

describe('seUnlockStage', () => {
  it('asks for the address while nothing is on file', () => {
    expect(seUnlockStage({ hasSubmission: false, reviewStatus: null })).toBe('send');
  });

  it('waits while an address is pending', () => {
    expect(seUnlockStage({ hasSubmission: true, reviewStatus: 'pending' })).toBe('waiting');
    expect(seUnlockStage({ hasSubmission: true, reviewStatus: null })).toBe('waiting');
  });

  it('reads approved even without a submission (approved through another route)', () => {
    expect(seUnlockStage({ hasSubmission: true, reviewStatus: 'approved' })).toBe('approved');
    expect(seUnlockStage({ hasSubmission: false, reviewStatus: 'approved' })).toBe('approved');
  });

  it('reads rejected, spam and duplicate as needing another look', () => {
    for (const reviewStatus of ['rejected', 'spam', 'duplicate']) {
      expect(seUnlockStage({ hasSubmission: true, reviewStatus })).toBe('another_look');
    }
  });
});
