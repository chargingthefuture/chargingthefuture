// Shared fixed-window rate limiter for public (unauthenticated) read endpoints.
//
// Honest limits of this design — read before reusing it elsewhere:
// - PER-PROCESS MEMORY ONLY. Counters live in a Map inside one Node server process. They
//   reset on every deploy/restart, and if the app ever runs on more than one instance each
//   instance counts independently (so the effective limit is limit × instances).
// - FIXED WINDOW. A caller can burst up to 2× the limit across a window boundary.
// - This is adequate as a first brake against bulk scraping and accidental floods of the
//   public endpoints. It is NOT a distributed quota, not billing-grade metering, and not a
//   substitute for a shared-store (e.g. Redis/Postgres) limiter if abuse becomes material.
//
// Existing per-feature limits (bug-reports, comic, level-up) count rows in Postgres per
// user; they gate authenticated writes and are unrelated to this per-IP read brake.

import { NextResponse } from 'next/server';

type WindowEntry = {
  windowStartMs: number;
  windowMs: number;
  count: number;
};

const windows = new Map<string, WindowEntry>();

// Prune at most once per this interval so a hot endpoint does not scan the Map on every
// request, while abandoned keys still get dropped and memory stays bounded.
const PRUNE_INTERVAL_MS = 60_000;
let lastPruneMs = 0;

function pruneExpired(nowMs: number): void {
  if (nowMs - lastPruneMs < PRUNE_INTERVAL_MS) {
    return;
  }
  lastPruneMs = nowMs;
  for (const [key, entry] of windows) {
    // An entry is dead weight once its own window has fully passed.
    if (nowMs - entry.windowStartMs >= entry.windowMs) {
      windows.delete(key);
    }
  }
}

// Fixed-window check: at most `limit` calls per `windowMs` for this key. Returns whether
// this call is allowed and, when it is not, how many whole seconds until the window resets.
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const nowMs = Date.now();
  pruneExpired(nowMs);

  const entry = windows.get(key);
  if (!entry || nowMs - entry.windowStartMs >= windowMs) {
    windows.set(key, { windowStartMs: nowMs, windowMs, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStartMs + windowMs - nowMs) / 1000));
  return { allowed: false, retryAfterSeconds };
}

// Shared policy for the public read endpoints: per IP, per route.
export const PUBLIC_READ_RATE_LIMIT = 30;
export const PUBLIC_READ_RATE_WINDOW_MS = 60_000;

// Client IP for rate-limit keying: first value of x-forwarded-for (set by the platform's
// proxy), 'unknown' when absent. 'unknown' callers share one bucket — acceptable for a
// brake whose goal is to bound total anonymous load, not to meter individuals precisely.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || 'unknown';
}

// Convenience gate for a public read route. Returns null when the call may proceed, or a
// ready-to-return 429 JSON response (with Retry-After) when the caller is over the limit.
export function enforcePublicReadRateLimit(request: Request, routeKey: string): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(
    `public:${routeKey}:${ip}`,
    PUBLIC_READ_RATE_LIMIT,
    PUBLIC_READ_RATE_WINDOW_MS,
  );
  if (result.allowed) {
    return null;
  }
  return NextResponse.json(
    { error: 'Too many requests. Wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}
