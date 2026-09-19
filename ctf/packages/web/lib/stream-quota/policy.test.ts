import { afterEach, describe, expect, it } from 'vitest';
import { resolveChymeQuotaPolicy } from './policy';
import { streamQuotaBandFor, chymeMaxParticipants, streamVideoMinutesBudget } from './constants';

// The quota policy is what stands between a busy month and a dark room. What matters: the bands
// fall at rule 110's percentages, the optional Video consumers pause at Orange and not before, the
// room itself stays open for a few people at Red rather than for nobody, and the caps follow the
// environment when it is set and the defaults when it is not.

const ENV_KEYS = ['STREAM_VIDEO_MINUTES_BUDGET', 'CHYME_MAX_PARTICIPANTS', 'CHYME_RED_BAND_MAX_PARTICIPANTS'] as const;

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe('streamQuotaBandFor', () => {
  it('places the four bands at 70, 85, and 95 percent', () => {
    expect(streamQuotaBandFor(0)).toBe('green');
    expect(streamQuotaBandFor(69.9)).toBe('green');
    expect(streamQuotaBandFor(70)).toBe('yellow');
    expect(streamQuotaBandFor(84.9)).toBe('yellow');
    expect(streamQuotaBandFor(85)).toBe('orange');
    expect(streamQuotaBandFor(94.9)).toBe('orange');
    expect(streamQuotaBandFor(95)).toBe('red');
    expect(streamQuotaBandFor(140)).toBe('red');
  });
});

describe('resolveChymeQuotaPolicy', () => {
  it('changes nothing in the Green band', () => {
    const policy = resolveChymeQuotaPolicy('green');
    expect(policy.guestListenAllowed).toBe(true);
    expect(policy.backChannelAllowed).toBe(true);
    expect(policy.memberCap).toBe(chymeMaxParticipants());
    expect(policy.memberNotice).toBeNull();
    expect(policy.guestPausedReason).toBeNull();
  });

  it('warns members in Yellow without pausing anything', () => {
    const policy = resolveChymeQuotaPolicy('yellow');
    expect(policy.guestListenAllowed).toBe(true);
    expect(policy.backChannelAllowed).toBe(true);
    expect(policy.memberNotice).toMatch(/close to its monthly limit/);
    expect(policy.guestPausedReason).toBeNull();
  });

  it('pauses guests and Back Channel in Orange and keeps the member cap', () => {
    const policy = resolveChymeQuotaPolicy('orange');
    expect(policy.guestListenAllowed).toBe(false);
    expect(policy.guestCap).toBe(0);
    expect(policy.backChannelAllowed).toBe(false);
    expect(policy.memberCap).toBe(chymeMaxParticipants());
    expect(policy.guestPausedReason).toMatch(/Sign in to join the room/);
  });

  it('keeps the room open for a few people in Red', () => {
    const policy = resolveChymeQuotaPolicy('red');
    expect(policy.guestListenAllowed).toBe(false);
    expect(policy.backChannelAllowed).toBe(false);
    expect(policy.memberCap).toBe(10);
    expect(policy.memberNotice).toContain('holds 10 people');
  });

  it('never raises the Red cap above the full cap', () => {
    process.env.CHYME_MAX_PARTICIPANTS = '4';
    process.env.CHYME_RED_BAND_MAX_PARTICIPANTS = '10';
    expect(resolveChymeQuotaPolicy('red').memberCap).toBe(4);
  });

  it('reads the caps from the environment when set and falls back on junk', () => {
    process.env.CHYME_MAX_PARTICIPANTS = '25';
    expect(chymeMaxParticipants()).toBe(25);
    process.env.CHYME_MAX_PARTICIPANTS = 'lots';
    expect(chymeMaxParticipants()).toBe(50);
    process.env.STREAM_VIDEO_MINUTES_BUDGET = '0';
    expect(streamVideoMinutesBudget()).toBe(333_000);
  });
});
