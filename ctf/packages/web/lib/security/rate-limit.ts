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
// Existing per-feature limits (bug-reports, comic, skill-up) count rows in Postgres per
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
  for (const [key, entry] of windows) {
    // An entry is dead weight once its own window has fully passed.
    if (nowMs - entry.windowStartMs >= entry.windowMs) {
      windows.delete(key);
    }
  }
  // Stamped after the loop: the whole prune is synchronous, so nothing can re-enter mid-loop,
  // and stamping last means a hypothetical future await inside the loop would fail toward
  // pruning again rather than silently skipping a cycle.
  lastPruneMs = nowMs;
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
    // Honour the limit even for the first call in a window, so limit=0 blocks everything.
    if (1 <= limit) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    return { allowed: false, retryAfterSeconds };
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

// Client IP for rate-limit keying; 'unknown' when nothing usable is present. 'unknown'
// callers share one bucket — acceptable for a brake whose goal is to bound total anonymous
// load, not to meter individuals precisely.
//
// WHY NOT the first x-forwarded-for value: that header is a comma list where each proxy
// APPENDS the address it received the connection from. The leftmost entries travel in from
// the outside world — a caller can send `x-forwarded-for: <anything>` and rotate through
// fake addresses to give themselves a fresh bucket per request, which voids the limit. The
// app deploys on Render, whose proxy appends to the incoming list rather than replacing it,
// so the first entry is exactly the part an attacker controls.
//
// What is used instead, in order:
// 1. cf-connecting-ip — set by Cloudflare (Render fronts services with it and forwards its
//    headers) to the address Cloudflare actually accepted the connection from.
// 2. The LAST x-forwarded-for entry — appended by the nearest proxy hop, which a caller
//    cannot forge. With more than one trusted hop this collapses distinct callers into the
//    upstream proxy's address; that fails toward limiting too much, never toward a bypass.
export function getClientIp(request: Request): string {
  const cloudflare = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflare) {
    return cloudflare;
  }
  const forwarded = request.headers.get('x-forwarded-for');
  const parts = forwarded?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  return parts[parts.length - 1] || 'unknown';
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
