import { describe, expect, it } from 'vitest';
import { bearerMatches, secretsMatch } from './internal-secret';

function requestWith(authorization: string | null): Request {
  const headers = new Headers();
  if (authorization !== null) {
    headers.set('authorization', authorization);
  }
  return new Request('https://example.test/api/internal/x', { method: 'POST', headers });
}

describe('secretsMatch', () => {
  it('matches only the exact value', () => {
    expect(secretsMatch('abc123', 'abc123')).toBe(true);
    expect(secretsMatch('abc124', 'abc123')).toBe(false);
    expect(secretsMatch('abc12', 'abc123')).toBe(false);
    expect(secretsMatch('abc1234', 'abc123')).toBe(false);
  });

  it('never matches an empty or missing value', () => {
    expect(secretsMatch('', '')).toBe(false);
    expect(secretsMatch(null, 'abc123')).toBe(false);
    expect(secretsMatch(undefined, 'abc123')).toBe(false);
    expect(secretsMatch('abc123', '')).toBe(false);
  });
});

describe('bearerMatches', () => {
  it('accepts exactly "Bearer <secret>"', () => {
    expect(bearerMatches(requestWith('Bearer s3cret'), 's3cret')).toBe(true);
  });

  it('refuses a wrong, missing or differently written header', () => {
    expect(bearerMatches(requestWith('Bearer s3cres'), 's3cret')).toBe(false);
    expect(bearerMatches(requestWith('s3cret'), 's3cret')).toBe(false);
    expect(bearerMatches(requestWith('bearer s3cret'), 's3cret')).toBe(false);
    expect(bearerMatches(requestWith(null), 's3cret')).toBe(false);
  });

  it('refuses everything when the secret is empty', () => {
    expect(bearerMatches(requestWith('Bearer '), '')).toBe(false);
  });
});
