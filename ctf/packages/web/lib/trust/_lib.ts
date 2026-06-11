import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from '../auth/server-authz';
import { checkMutationOrigin } from '../auth/csrf';
import { TRUST_ERROR_CODE } from './constants';

export type TrustApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

// Any authenticated, unlocked member may use the read/visibility/snapshot routes.
export async function requireTrustMemberAccess(): Promise<TrustApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Admin-only gate for verification review.
export async function requireTrustAdminAccess(): Promise<TrustApiGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'], requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

// Reject cross-site mutations: every state-changing request must carry the same-origin CSRF header
// the web client sets, and (when an Origin is present) match the app's host.
export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }
  return null;
}

export function trustErrorResponse(fallbackMessage: string) {
  return NextResponse.json(
    { ok: false, code: TRUST_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}

// A per-request correlation id for audit rows. Prefer the inbound trace header; fall back to a
// fresh UUID so every audit entry is correlatable even without an upstream id.
export function resolveRequestId(request: Request): string {
  return (
    request.headers.get('x-request-id') ??
    request.headers.get('x-ctf-request-id') ??
    crypto.randomUUID()
  );
}
