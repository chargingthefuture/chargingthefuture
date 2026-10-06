import { describe, expect, it } from 'vitest';
import { isAllowedMatchTransition } from './match-transitions';

describe('isAllowedMatchTransition', () => {
  it('lets a host accept or decline a pending request', () => {
    expect(isAllowedMatchTransition('host', 'pending', 'accepted')).toBe(true);
    expect(isAllowedMatchTransition('host', 'pending', 'rejected')).toBe(true);
  });

  it('lets a host mark an accepted stay completed, and nothing earlier', () => {
    expect(isAllowedMatchTransition('host', 'accepted', 'completed')).toBe(true);
    expect(isAllowedMatchTransition('host', 'pending', 'completed')).toBe(false);
  });

  it('never lets a host reopen a canceled or declined request', () => {
    expect(isAllowedMatchTransition('host', 'canceled', 'accepted')).toBe(false);
    expect(isAllowedMatchTransition('host', 'rejected', 'accepted')).toBe(false);
    expect(isAllowedMatchTransition('host', 'completed', 'accepted')).toBe(false);
  });

  it('lets a seeker cancel a pending or accepted match only', () => {
    expect(isAllowedMatchTransition('seeker', 'pending', 'canceled')).toBe(true);
    expect(isAllowedMatchTransition('seeker', 'accepted', 'canceled')).toBe(true);
    expect(isAllowedMatchTransition('seeker', 'completed', 'canceled')).toBe(false);
    expect(isAllowedMatchTransition('seeker', 'rejected', 'canceled')).toBe(false);
  });

  it('never lets a seeker accept their own request', () => {
    expect(isAllowedMatchTransition('seeker', 'pending', 'accepted')).toBe(false);
  });
});
