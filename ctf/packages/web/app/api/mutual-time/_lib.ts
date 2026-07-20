import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { MutualTimeError } from 'lib/mutual-time/repository';

export type MutualTimeGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Tier (a): admin-only (create an event, close a survey). The platform owner is an admin.
export async function requireMutualTimeAdmin(): Promise<MutualTimeGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Tier (b): a signed-in AND Unlock-approved member (cast a vote). Admins pass too.
export async function requireMutualTimeVote(): Promise<MutualTimeGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'approved_full' });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Same-origin CSRF guard for mutations: the request must carry `x-ctf-csrf: '1'` and originate from our
// own host. Mirrors the Chyme helper. Returns a 403 response to send back, or null when it passes.
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }
  return null;
}

// Map a caught MutualTimeError to an HTTP status + JSON; returns null for anything else (route → 500).
export function mutualTimeErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof MutualTimeError) {
    const status =
      error.code === MUTUAL_TIME_ERROR_CODE.invalidPayload || error.code === MUTUAL_TIME_ERROR_CODE.invalidSlot || error.code === MUTUAL_TIME_ERROR_CODE.tooManyPicks
        ? 400
        : error.code === MUTUAL_TIME_ERROR_CODE.notFound
          ? 404
          : error.code === MUTUAL_TIME_ERROR_CODE.notOpen
            ? 409
            : 500;
    return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
  }
  return null;
}
