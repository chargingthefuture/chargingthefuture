import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlockAccessTier } from './types';

// The stored submission row decides a member's tier whenever one exists. The Unleash flag is read
// only for a member with no row, so a member approved once and later rejected, revoked or sent back
// to review cannot keep full access through a flag entry nothing removed.
let storedTier: UnlockAccessTier | null = null;
let flagOn = false;
let commonsFallback = false;
const flagCalls: string[] = [];

vi.mock('./repository', () => ({
  getEffectiveUnlockAccessTier: vi.fn(async () => storedTier),
}));

vi.mock('./help-requests', () => ({
  hasUnlockCommonsFallback: vi.fn(async () => commonsFallback),
}));

vi.mock('lib/feature-flags', () => ({
  evaluateBooleanFlag: vi.fn(async (_key: string, _fallback: boolean, context: { targetingKey: string }) => {
    flagCalls.push(context.targetingKey);
    return flagOn;
  }),
}));

const { getUnlockAccessTier } = await import('./access');

describe('getUnlockAccessTier', () => {
  beforeEach(() => {
    storedTier = null;
    flagOn = false;
    commonsFallback = false;
    flagCalls.length = 0;
  });

  it('keeps a rejected or revoked member support-only even when the flag is still on', async () => {
    storedTier = 'locked_support_only';
    flagOn = true;
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('locked_support_only');
    expect(flagCalls).toEqual([]);
  });

  it('keeps a member back in review out of full access even when the flag is still on', async () => {
    storedTier = 'pending_readonly';
    flagOn = true;
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('pending_readonly');
  });

  it('gives an approved row full access without asking the flag', async () => {
    storedTier = 'approved_full';
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('approved_full');
    expect(flagCalls).toEqual([]);
  });

  it('gives a member with no row full access when the flag is on for them', async () => {
    flagOn = true;
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('approved_full');
    expect(flagCalls).toEqual(['user_1']);
  });

  it('opens the Commons for a member with no row and no flag who asked for help', async () => {
    commonsFallback = true;
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('locked_support_only');
  });

  it('returns null for a member with no row, no flag and no help request', async () => {
    await expect(getUnlockAccessTier('user_1')).resolves.toBeNull();
  });
});
