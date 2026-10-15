import { describe, expect, it } from 'vitest';
import { describeFailure } from './reason';

// Built structurally: this package's TypeScript library setting (ES2020) declares neither
// Error.cause nor AggregateError.
function withCause<T extends Error>(error: T, cause: unknown): T {
  return Object.assign(error, { cause });
}

function aggregate(errors: Error[]): Error {
  return Object.assign(new Error(''), { name: 'AggregateError', errors });
}

function coded(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('describeFailure', () => {
  it('keeps a plain error message as it is', () => {
    expect(describeFailure(new Error('relation does not exist'), 300)).toBe('relation does not exist');
  });

  it('names the cause behind a failed fetch', () => {
    const error = withCause(new TypeError('fetch failed'), coded('connect ECONNREFUSED 127.0.0.1:443', 'ECONNREFUSED'));
    expect(describeFailure(error, 300)).toBe('fetch failed (connect ECONNREFUSED 127.0.0.1:443)');
  });

  it('adds the code when the cause message does not carry it', () => {
    const error = withCause(new TypeError('fetch failed'), coded('getaddrinfo failed', 'ENOTFOUND'));
    expect(describeFailure(error, 300)).toBe('fetch failed (ENOTFOUND: getaddrinfo failed)');
  });

  it('reads the first inner error of an AggregateError with no message', () => {
    const error = aggregate([coded('connect ECONNREFUSED ::1:5432', 'ECONNREFUSED')]);
    expect(describeFailure(error, 300)).toBe('connect ECONNREFUSED ::1:5432');
  });

  it('reads an AggregateError cause', () => {
    const error = withCause(new TypeError('fetch failed'), aggregate([coded('connect ETIMEDOUT 10.0.0.1:443', 'ETIMEDOUT')]));
    expect(describeFailure(error, 300)).toBe('fetch failed (connect ETIMEDOUT 10.0.0.1:443)');
  });

  it('accepts a string cause', () => {
    expect(describeFailure(withCause(new Error('upstream failed'), 'timeout'), 300)).toBe('upstream failed (timeout)');
  });

  it('caps the joined reason', () => {
    const text = describeFailure(withCause(new Error('fetch failed'), new Error('x'.repeat(400))), 50);
    expect(text).toHaveLength(51);
    expect(text.endsWith('…')).toBe(true);
  });

  it('falls back when nothing is readable', () => {
    expect(describeFailure(new Error(''), 300)).toBe('Error with no message');
    expect(describeFailure('', 300)).toBe('unknown error');
  });
});
