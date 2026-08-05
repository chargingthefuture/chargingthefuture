import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { ensureTrustTransportAdmin } from 'lib/trust-transport/policy';
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
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
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

// A non-empty trimmed idempotency key is kept as-is; anything else falls back to the caller's key.
export function resolveIdempotencyKey(value: unknown, fallbackKey: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallbackKey;
}

// Maps a repository error message to its member-facing response shape. Keeping this as a lookup keeps
// trustTransportErrorResponse a single table read instead of a long branch chain.
type TrustTransportErrorResponse = { code: string; message: string; status: number };

const TRUST_TRANSPORT_ERROR_RESPONSES: Record<string, TrustTransportErrorResponse> = {
  invalid_mode: { code: TRUST_TRANSPORT_ERROR_CODE.invalidMode, message: 'Mode is invalid.', status: 400 },
  request_not_found: { code: TRUST_TRANSPORT_ERROR_CODE.requestNotFound, message: 'Request not found.', status: 404 },
  offer_not_found: { code: TRUST_TRANSPORT_ERROR_CODE.offerNotFound, message: 'Offer not found.', status: 404 },
  trip_not_found: { code: TRUST_TRANSPORT_ERROR_CODE.tripNotFound, message: 'Trip not found.', status: 404 },
  incident_not_found: { code: TRUST_TRANSPORT_ERROR_CODE.incidentNotFound, message: 'Incident not found.', status: 404 },
  invalid_transition: { code: TRUST_TRANSPORT_ERROR_CODE.invalidTransition, message: 'Invalid status transition.', status: 409 },
  completion_requires_confirmation: {
    code: TRUST_TRANSPORT_ERROR_CODE.completionRequiresConfirmation,
    message: 'Both the requester and the provider must confirm before a trip can be marked complete.',
    status: 409,
  },
  policy_denied: { code: TRUST_TRANSPORT_ERROR_CODE.policyDenied, message: 'Operation denied by policy.', status: 403 },
  // Neutral copy on purpose (mirrors LightHouse): a block must not reveal itself to the blocked person.
  blocked_pair: { code: TRUST_TRANSPORT_ERROR_CODE.mutualBlock, message: 'This request is not available to you.', status: 403 },
  insufficient_balance: { code: TRUST_TRANSPORT_ERROR_CODE.insufficientBalance, message: 'Insufficient available balance.', status: 409 },
  account_restricted: { code: TRUST_TRANSPORT_ERROR_CODE.accountRestricted, message: 'Account is restricted.', status: 403 },
  invalid_payload: { code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid payload.', status: 400 },
};

export function trustTransportErrorResponse(error: unknown, fallbackMessage: string) {
  const code = error instanceof Error ? error.message : '';

  const mapped = TRUST_TRANSPORT_ERROR_RESPONSES[code];
  if (mapped) {
    return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: mapped.status });
  }

  reportError(error, { area: 'trust-transport', op: 'unknown' });
  return NextResponse.json(
    { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}
