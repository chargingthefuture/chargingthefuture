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

// Known ServiceCredits error messages that map straight to a JSON response with no side effect.
// One error.message can match at most one entry, so table lookup preserves the original if-chain's
// behavior exactly (these branches never called reportError before returning).
const SERVICE_CREDITS_SIMPLE_ERROR_RESPONSES: Record<string, { code: string; message: string; status: number }> = {
  insufficient_balance: { code: 'service_credits_insufficient_balance', message: 'Insufficient balance.', status: 409 },
  invalid_payload: { code: 'service_credits_invalid_payload', message: 'Invalid ServiceCredits payload.', status: 400 },
  transfer_conflict: { code: 'service_credits_transfer_conflict', message: 'Unable to resolve idempotent transfer state.', status: 409 },
  not_found: { code: 'service_credits_not_found', message: 'Requested resource was not found.', status: 404 },
  invalid_state: { code: 'service_credits_invalid_state', message: 'Resource is not in a valid state for this command.', status: 409 },
  reclaim_window_not_elapsed: { code: 'service_credits_reclaim_window_not_elapsed', message: 'Deletion reclaim window has not elapsed.', status: 409 },
  active_escrow_holds: { code: 'service_credits_active_escrow_holds', message: 'Deletion reclaim blocked by active escrow holds.', status: 409 },
};

// External-ledger error messages. These branches DID call reportError before returning a 503, so the
// lookup path below reports the error just as the original if-chain did.
const SERVICE_CREDITS_LEDGER_ERROR_RESPONSES: Record<string, { code: string; message: string }> = {
  external_ledger_not_configured: { code: 'service_credits_external_ledger_not_configured', message: 'Formance ledger is not configured for ServiceCredits.' },
  external_ledger_unavailable: { code: 'service_credits_external_ledger_unavailable', message: 'Formance ledger rejected or failed the command.' },
};

export function serviceCreditsErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof Error) {
    const simple = SERVICE_CREDITS_SIMPLE_ERROR_RESPONSES[error.message];
    if (simple) {
      return NextResponse.json({ ok: false, code: simple.code, message: simple.message }, { status: simple.status });
    }

    const ledger = SERVICE_CREDITS_LEDGER_ERROR_RESPONSES[error.message];
    if (ledger) {
      reportError(error, { area: 'service-credits', op: 'unknown' });
      return NextResponse.json({ ok: false, code: ledger.code, message: ledger.message }, { status: 503 });
    }
  }

  reportError(error, { area: 'service-credits', op: 'unknown' });
  return NextResponse.json({ ok: false, code: 'service_credits_unavailable', message: fallbackMessage }, { status: 503 });
}
