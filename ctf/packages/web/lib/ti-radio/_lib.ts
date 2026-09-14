// Access gates for TI Radio. Three postures, and the first is the one the plugin exists for.
//
//   readPublic  — no account at all. A broadcast guide nobody can read is not a guide. A visitor
//                 sees the whole schedule: times, hosts' handles, and what each one is about.
//   requireHost — a signed-in member approved in Unlock, the default gate everything else in this
//                 app uses. Taking a slot puts a member's name on a time in public and commits
//                 them to turning up, so it is not a route into verification the way writing a
//                 comment is; it is a thing you do once you are in.
//   requireAdmin — taking somebody's slot off the schedule.

import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { resolveRequestIdentity } from 'lib/auth/request-identity';
import { TI_RADIO_ERROR_CODE } from './constants';
import { TiRadioError } from './errors';

export type TiRadioGate = { allowed: true; auth: AllowDecision } | { allowed: false; response: NextResponse };

/**
 * Who is reading, when reading needs no account. Returns a user id for a signed-in reader so the
 * page can mark their own slots, and nulls for everybody else. Never denies: a signed-out reader is
 * the ordinary case here, and an identity lookup that fails must not take the public guide down.
 */
export async function readerIdentity(): Promise<{ userId: string | null; isAdmin: boolean }> {
  try {
    const identity = await resolveRequestIdentity();
    if (!identity.isAuthenticated || !identity.userId) {
      return { userId: null, isAdmin: false };
    }
    return { userId: identity.userId, isAdmin: Boolean(identity.isAdmin) };
  } catch {
    return { userId: null, isAdmin: false };
  }
}

export async function requireTiRadioHost(): Promise<TiRadioGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'approved_full' });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

export async function requireTiRadioAdmin(): Promise<TiRadioGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

/** Same-origin guard for mutations: the `x-ctf-csrf` header plus an origin that is ours. */
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: TI_RADIO_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: TI_RADIO_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: TI_RADIO_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }
  return null;
}

/** Map a TiRadioError onto its HTTP status and JSON body; null for anything else, which is a 500. */
export function tiRadioErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof TiRadioError)) {
    return null;
  }
  const status = errorStatus(error.code);
  return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
}

function errorStatus(code: string): number {
  switch (code) {
    case TI_RADIO_ERROR_CODE.invalidPayload:
    case TI_RADIO_ERROR_CODE.slotPast:
      return 400;
    case TI_RADIO_ERROR_CODE.forbidden:
      return 403;
    case TI_RADIO_ERROR_CODE.notFound:
      return 404;
    // A slot somebody else took a moment earlier, and a member already at their ceiling, are both
    // "the request was fine, the world moved" — a conflict, not a malformed request.
    case TI_RADIO_ERROR_CODE.slotTaken:
    case TI_RADIO_ERROR_CODE.dailyLimit:
      return 409;
    case TI_RADIO_ERROR_CODE.persistenceUnavailable:
      return 503;
    default:
      return 500;
  }
}
