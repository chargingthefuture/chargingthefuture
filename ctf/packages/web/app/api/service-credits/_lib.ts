import { NextResponse } from 'next/server';
import { ensureServiceCreditsAdmin } from 'lib/service-credits/policy';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { reportError } from 'lib/observability/report';

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
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'Invalid service credits payload.' }, { status: 400 });
  }

  if (error instanceof Error && error.message === 'transfer_conflict') {
    return NextResponse.json({ ok: false, code: 'service_credits_transfer_conflict', message: 'Unable to resolve idempotent transfer state.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'not_found') {
    return NextResponse.json({ ok: false, code: 'service_credits_not_found', message: 'Requested resource was not found.' }, { status: 404 });
  }

  if (error instanceof Error && error.message === 'invalid_state') {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_state', message: 'Resource is not in a valid state for this command.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'reclaim_window_not_elapsed') {
    return NextResponse.json({ ok: false, code: 'service_credits_reclaim_window_not_elapsed', message: 'Deletion reclaim window has not elapsed.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'active_escrow_holds') {
    return NextResponse.json({ ok: false, code: 'service_credits_active_escrow_holds', message: 'Deletion reclaim blocked by active escrow holds.' }, { status: 409 });
  }

  if (error instanceof Error && error.message === 'external_ledger_not_configured') {
    reportError(error, { area: 'service-credits', op: 'unknown' });
    return NextResponse.json(
      { ok: false, code: 'service_credits_external_ledger_not_configured', message: 'Formance ledger is not configured for Service Credits.' },
      { status: 503 },
    );
  }

  if (error instanceof Error && error.message === 'external_ledger_unavailable') {
    reportError(error, { area: 'service-credits', op: 'unknown' });
    return NextResponse.json(
      { ok: false, code: 'service_credits_external_ledger_unavailable', message: 'Formance ledger rejected or failed the command.' },
      { status: 503 },
    );
  }

  reportError(error, { area: 'service-credits', op: 'unknown' });
  return NextResponse.json({ ok: false, code: 'service_credits_unavailable', message: fallbackMessage }, { status: 503 });
}
