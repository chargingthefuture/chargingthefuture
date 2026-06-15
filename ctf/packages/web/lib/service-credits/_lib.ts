import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from '../auth/server-authz';
import { ensureServiceCreditsAdmin } from './policy';
import { checkMutationOrigin } from '../auth/csrf';

export async function requireServiceCreditsReadAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true as const, auth: decision };
}

export async function requireServiceCreditsAdminAccess() {
  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureServiceCreditsAdmin(gate.auth);
  if (deny) {
    return { allowed: false as const, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, code: 'service_credits_csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json({ ok: false, code: 'service_credits_csrf_denied', message: 'Invalid request origin metadata.' }, { status: 403 });
  }
  if (originCheck === 'cross_origin') {
    return NextResponse.json({ ok: false, code: 'service_credits_csrf_denied', message: 'Cross-origin mutation denied by CSRF policy.' }, { status: 403 });
  }

  return null;
}

export function serviceCreditsErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof Error && error.message === 'insufficient_balance') {
    return NextResponse.json({ ok: false, code: 'service_credits_insufficient_balance', message: 'Insufficient balance.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'invalid_payload') {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'Invalid request payload.' }, { status: 400 });
  }

  if (error instanceof Error && error.message === 'credit_limit_exceeded') {
    return NextResponse.json({ ok: false, code: 'service_credits_credit_limit_exceeded', message: 'This payment would exceed your mutual-credit limit.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'mutual_credit_disabled') {
    return NextResponse.json({ ok: false, code: 'service_credits_mutual_credit_disabled', message: 'Mutual credit is not enabled.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'mint_budget_exceeded') {
    return NextResponse.json({ ok: false, code: 'service_credits_mint_budget_exceeded', message: 'This mint would exceed the issuance budget for the current period.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'credit_limit_above_max') {
    return NextResponse.json({ ok: false, code: 'service_credits_credit_limit_above_max', message: 'That credit limit is above the maximum allowed by policy.' }, { status: 409 });
  }

  return NextResponse.json({ ok: false, code: 'service_credits_error', message: fallbackMessage }, { status: 500 });
}
