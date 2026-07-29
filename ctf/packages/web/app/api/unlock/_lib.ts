import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ensureUnlockAdmin } from 'lib/unlock/policy';
import { checkMutationOrigin } from 'lib/auth/csrf';

// CSRF guard for unlock admin mutations that move ServiceCredits (reward grant determination, revoke).
// Requires the same `x-ctf-csrf: 1` confirmation header + same-origin check the ServiceCredits admin uses,
// so a destructive money action can't be driven cross-origin. Returns a 403 response to short-circuit, or
// null when the request is allowed.
export function ensureUnlockMutationCsrf(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json({ ok: false, message: 'Invalid request origin metadata.' }, { status: 403 });
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json({ ok: false, message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
  }
  return null;
}

// A per-request correlation id for unlock audit rows. Prefer an inbound trace header; fall back to a
// fresh UUID so every audit entry is correlatable even when no upstream id was supplied. The audit
// contract marks requestId as a required field, so every insertUnlockAudit call passes one.
export function resolveUnlockRequestId(request: Request): string {
  return (
    request.headers.get('x-request-id') ??
    request.headers.get('x-ctf-request-id') ??
    crypto.randomUUID()
  );
}

// Re-exported from lib/unlock/quora-url.ts so every existing caller here is unchanged. It moved to
// lib/ because the knowledge-library contribution path opens an Unlock submission too, and lib must
// not import from app.
export { normalizeQuoraProfileUrl } from 'lib/unlock/quora-url';

export async function requireUnlockUserAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'any_authenticated' });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export async function requireUnlockAdminAccess() {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureUnlockAdmin(gate.auth);
  if (deny) {
    return { allowed: false as const, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

export function unlockErrorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, message }, { status });
}
