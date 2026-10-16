import { describe, expect, it } from 'vitest';
import { isStreamNotFoundError } from 'lib/shared/stream-error-text';
import { hoursUntilNextAttempt, MAX_CLEANUP_ATTEMPTS } from './external-cleanup-retries';

// Failed Stream cleanups after a deletion are retried hourly (issue #2703). The wait grows so an
// outage of a few hours passes, and stops growing at a day so a copy never sits for long between tries.
describe('hoursUntilNextAttempt', () => {
  it('waits 1, 2, 4, 8, 16, then 24 hours', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 11].map(hoursUntilNextAttempt)).toEqual([1, 2, 4, 8, 16, 24, 24, 24]);
  });

  it('gives up after a few days, not after hours or weeks', () => {
    let hours = 0;
    for (let attempt = 1; attempt < MAX_CLEANUP_ATTEMPTS; attempt += 1) {
      hours += hoursUntilNextAttempt(attempt);
    }
    expect(hours / 24).toBeGreaterThan(2);
    expect(hours / 24).toBeLessThan(8);
  });
});

// A member who never opened a plugin has no Stream user for it, and a retry finds the user the
// first attempt already removed. Stream answers both with code 16, which has to count as done, or
// every deletion would record failures that can never succeed.
describe('isStreamNotFoundError', () => {
  it('matches Stream code 16 only', () => {
    expect(isStreamNotFoundError(Object.assign(new Error('DeleteUser failed'), { code: 16 }))).toBe(true);
    expect(isStreamNotFoundError(Object.assign(new Error('Rate limited'), { code: 9 }))).toBe(false);
    expect(isStreamNotFoundError(new Error('network'))).toBe(false);
    expect(isStreamNotFoundError(null)).toBe(false);
  });
});
