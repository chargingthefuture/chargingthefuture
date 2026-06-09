import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from '../auth/server-authz';
import { getAppUrl } from '../auth/runtime-env';
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
  const appUrl = getAppUrl();
  const origin = request.headers.get('origin');
  if (!appUrl || !origin) {
    return null;
  }
  try {
    if (new URL(appUrl).host !== new URL(origin).host) {
      return NextResponse.json(
        { ok: false, code: TRUST_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
        { status: 403 },
      );
    }
  } catch {}
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
