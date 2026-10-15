import { describe, expect, it } from 'vitest';
import { hashInviteSeed, inviteAvatarGradient, inviteInitials } from './invite-avatar';

describe('inviteInitials', () => {
  it('takes the first and last words of a longer name', () => {
    expect(inviteInitials('Pam Dawson')).toBe('PD');
    expect(inviteInitials('Gn0b0dy Pneuma')).toBe('GP');
    expect(inviteInitials('Mary Ann de la Cruz')).toBe('MC');
  });

  it('takes the first character alone for a one-word name', () => {
    expect(inviteInitials('00')).toBe('0');
    expect(inviteInitials('brecht')).toBe('B');
  });

  it('skips punctuation and extra spaces', () => {
    expect(inviteInitials('T. Tipton')).toBe('TT');
    expect(inviteInitials('  steph   wo ')).toBe('SW');
    expect(inviteInitials('"Eli"')).toBe('E');
  });

  it('keeps an accented letter intact and falls back for an empty name', () => {
    expect(inviteInitials('élodie')).toBe('É');
    expect(inviteInitials('   ')).toBe('?');
  });
});

describe('inviteAvatarGradient', () => {
  it('is stable for the same seed and ignores case and spaces around it', () => {
    expect(inviteAvatarGradient('pam-dawson')).toEqual(inviteAvatarGradient(' Pam-Dawson '));
  });

  it('spreads different seeds across the palette', () => {
    const picks = new Set(['ann-1', 'sam-example-1', 'eli', 'brecht', '00', 'pam-dawson', 't-tipton', 'steph-wo'].map((seed) => inviteAvatarGradient(seed).from + inviteAvatarGradient(seed).to));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('hashes to an unsigned 32-bit number', () => {
    const hash = hashInviteSeed('sam-example-1');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});
