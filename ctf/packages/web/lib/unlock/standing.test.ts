import { describe, expect, it } from 'vitest';
import { seUnlockStanding } from '@ctf/shared';

const now = new Date('2026-10-27T12:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe('Unlock standing in 3.1', () => {
  it('counts from the first sign-in and can be closed in the first week', () => {
    const s = seUnlockStanding({ approved: false, firstSeenIso: daysAgo(0), countStopped: false }, now);
    expect([s.day, s.closable, s.paused, s.title]).toEqual([1, true, false, 'Day 1 of 14']);
  });

  it('cannot be closed in the second week', () => {
    const s = seUnlockStanding({ approved: false, firstSeenIso: daysAgo(8), countStopped: false }, now);
    expect([s.day, s.closable, s.paused]).toEqual([9, false, false]);
  });

  it('pauses posting after day 14 unless the address was sent', () => {
    expect(seUnlockStanding({ approved: false, firstSeenIso: daysAgo(14), countStopped: false }, now).paused).toBe(true);
    expect(seUnlockStanding({ approved: false, firstSeenIso: daysAgo(30), countStopped: true }, now).paused).toBe(false);
  });

  it('says nothing to an approved member', () => {
    expect(seUnlockStanding({ approved: true, firstSeenIso: daysAgo(40), countStopped: false }, now)).toMatchObject({ approved: true, paused: false });
  });
});
