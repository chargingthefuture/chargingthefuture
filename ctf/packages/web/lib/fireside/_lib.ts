// Access gates for Fireside.
//
// Three postures, and the first is the one this plugin exists for:
//
//   readPublic      — no account at all. The blog is public, so the conversation under it is too.
//                     Quora gates viewing; this deliberately does not.
//   requireAuthor   — a signed-in member, approved or not. Writing is a route INTO verification,
//                     the same reasoning the Knowledge Library contribution exception already runs
//                     on: judging what somebody wrote is the same look Unlock asks for, so gating
//                     it would review the same account twice. Nothing written is publicly visible
//                     until that person is approved — see lib/fireside/visibility.ts.
//   requireAdmin    — moderation.

import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { resolveRequestIdentity } from 'lib/auth/request-identity';
import { FIRESIDE_ERROR_CODE } from './constants';

/**
 * Who is reading, when reading needs no account. Returns a user id for a signed-in reader so their
 * own held comments can be shown back to them, and null for everybody else. Never denies.
 */
export async function readerIdentity(): Promise<{ userId: string | null; username: string | null }> {
  try {
    const identity = await resolveRequestIdentity();
    if (!identity.isAuthenticated || !identity.userId) return { userId: null, username: null };
    return { userId: identity.userId, username: identity.username ?? null };
  } catch {
    // A signed-out reader is the ordinary case here, and an identity lookup that fails must not
    // take the public page down with it.
    return { userId: null, username: null };
  }
}

export async function requireFiresideAuthor() {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'any_authenticated' });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true as const, auth: decision };
}

export async function requireFiresideAdmin() {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true as const, auth: decision };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') return null;

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }
  return null;
}
