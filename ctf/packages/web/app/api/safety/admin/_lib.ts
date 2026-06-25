import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { SAFETY_ERROR_CODE } from 'lib/safety/constants';

// Shared helpers for the admin-only safety-report routes under `/api/safety/admin/**` (issue #809,
// task 3). The safety-report queue is the only path by which a member block reaches the admin, so
// these routes are admin-gated server-side regardless of what any nav shows (rule 131).

export type SafetyAdminGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

export async function requireSafetyAdminAccess(): Promise<SafetyAdminGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return { allowed: true, auth: decision };
}

// Same-origin CSRF guard for state-changing requests, mirroring the account/bug-report helpers.
// Requires the `x-ctf-csrf: 1` header and, when origin metadata is present, a matching host.
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: SAFETY_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: SAFETY_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: SAFETY_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}
