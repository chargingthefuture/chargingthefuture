import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { TRUSTTRANSPORT_ERROR_CODE } from 'lib/trusttransport/constants';
import { ensureTrustTransportAdmin, ensureTrustTransportProviderRole } from 'lib/trusttransport/policy';
import { reportError } from 'lib/observability/report';

export type TrustTransportApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

export async function requireTrustTransportReadAccess(): Promise<TrustTransportApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true, auth: decision };
}

export async function requireTrustTransportProviderAccess(): Promise<TrustTransportApiGate> {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureTrustTransportProviderRole(gate.auth);
  if (deny) {
    return { allowed: false, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

export async function requireTrustTransportAdminAccess(): Promise<TrustTransportApiGate> {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureTrustTransportAdmin(gate.auth);
  if (deny) {
    return { allowed: false, response: NextResponse.json(deny, { status: deny.status }) };
  }

  return gate;
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}

export function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function trustTransportErrorResponse(error: unknown, fallbackMessage: string) {
  const code = error instanceof Error ? error.message : '';

  if (code === 'invalid_mode') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidMode, message: 'Mode is invalid.' }, { status: 400 });
  }

  if (code === 'request_not_found') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.requestNotFound, message: 'Request not found.' }, { status: 404 });
  }

  if (code === 'offer_not_found') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.offerNotFound, message: 'Offer not found.' }, { status: 404 });
  }

  if (code === 'trip_not_found') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.tripNotFound, message: 'Trip not found.' }, { status: 404 });
  }

  if (code === 'incident_not_found') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.incidentNotFound, message: 'Incident not found.' }, { status: 404 });
  }

  if (code === 'invalid_transition') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidTransition, message: 'Invalid status transition.' }, { status: 409 });
  }

  if (code === 'policy_denied') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.policyDenied, message: 'Operation denied by policy.' }, { status: 403 });
  }

  if (code === 'insufficient_balance') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.insufficientBalance, message: 'Insufficient available balance.' }, { status: 409 });
  }

  if (code === 'account_restricted') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.accountRestricted, message: 'Account is restricted.' }, { status: 403 });
  }

  if (code === 'provider_required') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.providerRequired, message: 'Provider role required.' }, { status: 403 });
  }

  if (code === 'invalid_payload') {
    return NextResponse.json({ ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
  }

  reportError(error, { area: 'trusttransport', op: 'unknown' });
  return NextResponse.json(
    { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}
