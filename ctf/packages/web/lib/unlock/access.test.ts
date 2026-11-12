import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlockAccessTier } from './types';

// The stored submission row decides a member's tier whenever one exists; with no row, or a row
// below full access, the Commons fallback decides.
let storedTier: UnlockAccessTier | null = null;
let commonsFallback = false;

vi.mock('./repository', () => ({
  getEffectiveUnlockAccessTier: vi.fn(async () => storedTier),
}));

vi.mock('./help-requests', () => ({
  hasUnlockCommonsFallback: vi.fn(async () => commonsFallback),
}));

const { getUnlockAccessTier } = await import('./access');

describe('getUnlockAccessTier', () => {
  beforeEach(() => {
    storedTier = null;
    commonsFallback = false;
  });

  it('keeps a rejected or revoked member support-only', async () => {
    storedTier = 'locked_support_only';
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('locked_support_only');
  });

  it('keeps a member back in review out of full access', async () => {
    storedTier = 'pending_readonly';
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('pending_readonly');
  });

  it('gives an approved row full access', async () => {
    storedTier = 'approved_full';
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('approved_full');
  });

  it('opens the Commons for a member with no row who asked for help', async () => {
    commonsFallback = true;
    await expect(getUnlockAccessTier('user_1')).resolves.toBe('locked_support_only');
  });

  it('returns null for a member with no row and no help request', async () => {
    await expect(getUnlockAccessTier('user_1')).resolves.toBeNull();
  });
});
