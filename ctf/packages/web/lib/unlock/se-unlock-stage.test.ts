import { describe, expect, it } from 'vitest';
import { seRemovedAccounts, seUnlockScreenReady, seUnlockSendCard, seUnlockStage } from '@ctf/shared';

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

describe('seUnlockScreenReady, seUnlockSendCard and seRemovedAccounts', () => {
  const open = { approved: false, dayLabel: 'Day 9 of 14', progress: 9 / 14, paused: false, form: true, title: 'T', text: 'X' };

  it('reads a stopped count with nothing sent as a help request', () => {
    expect(seUnlockScreenReady({ hasSubmission: false, reviewStatus: null }, { ...open, form: false }).helpAsked).toBe(true);
    expect(seUnlockScreenReady({ hasSubmission: false, reviewStatus: null }, open).helpAsked).toBe(false);
    expect(seUnlockScreenReady({ hasSubmission: false, reviewStatus: null }, null).helpAsked).toBe(false);
  });

  it('draws the banner card while open, the card color once paused, a plain title without a standing', () => {
    expect(seUnlockSendCard(open)).toEqual({ pick: true, dayLabel: 'Day 9 of 14', progressPercent: 64, title: 'T', text: 'X' });
    expect(seUnlockSendCard({ ...open, paused: true, dayLabel: '' }).pick).toBe(false);
    expect(seUnlockSendCard(null)).toMatchObject({ pick: true, dayLabel: '', text: null });
  });

  it('lists reported removed accounts, and says why when the read failed', () => {
    expect(seRemovedAccounts(true, { ok: true, removedAccounts: [{ handle: 'A-1' }] })).toEqual({ handles: ['A-1'], readError: null });
    expect(seRemovedAccounts(false, null).readError).toContain('the server did not answer');
  });
});
