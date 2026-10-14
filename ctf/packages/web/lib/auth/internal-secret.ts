import { timingSafeEqual } from 'crypto';

// Shared-secret checks for the machine-only routes under app/api/internal. Those routes gate account
// deletion, ServiceCredits reclaims and scheduled jobs, and a plain `===` stops at the first
// character that differs, so how long a refusal takes says how much of a guess was right. These
// compare in constant time instead, the same way lib/auth/service-consumer.ts checks its tokens.
//
// Each route still decides for itself whether its secret is configured and which status to answer;
// these helpers only compare. An empty expected value never matches, so a route that forgets its own
// presence check still fails closed.

/** True when `given` equals `expected`, compared in constant time. False for an empty expected value. */
export function secretsMatch(given: string | null | undefined, expected: string): boolean {
  if (!given || expected.length === 0) {
    return false;
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/** True when the request's Authorization header is exactly `Bearer <secret>`, compared in constant time. */
export function bearerMatches(request: Request, secret: string): boolean {
  if (secret.length === 0) {
    return false;
  }
  return secretsMatch(request.headers.get('authorization'), `Bearer ${secret}`);
}
