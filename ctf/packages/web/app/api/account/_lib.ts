import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';

// Shared helpers for the account-level deletion routes under `/api/account/**`.
//
// Auth posture matches the existing account routes (full-account, chyme-profile, skills-hunt-
// profile): any signed-in identity may delete their own data, including unlock-pending users, so a
// user can always exercise their right to be forgotten. There is no role requirement — deletion is
// strictly self-service and only ever touches the caller's own rows.

export async function requireAccountAccess() {
  const decision = await evaluatePluginAccess({
    requireUsername: false,
    minUnlockTier: 'any_authenticated',
  });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

// Same-origin CSRF guard for state-changing requests, mirroring the per-plugin `ensureMutationCsrf`
// helpers. Requires the `x-ctf-csrf: 1` header and, when origin metadata is present, a matching
// host. Returns a 403 response to short-circuit, or null to proceed.
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}
