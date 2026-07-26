import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { ensureSocketRelayAdmin } from 'lib/socket-relay/policy';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import { reportError } from 'lib/observability/report';

export type SocketRelayApiGate =
  | { allowed: true; auth: AllowDecision }
  | { allowed: false; response: NextResponse };

export async function requireSocketRelayReadAccess(): Promise<SocketRelayApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }

  return { allowed: true, auth: decision };
}

export async function requireSocketRelayAdminAccess(): Promise<SocketRelayApiGate> {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate;
  }

  const deny = ensureSocketRelayAdmin(gate.auth);
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
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
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

export function socketRelayErrorResponse(error: unknown, fallbackMessage: string) {
  const code = error instanceof Error ? error.message : '';

  if (code === 'request_not_found') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.requestNotFound, message: 'SocketRelay request not found.' },
      { status: 404 },
    );
  }

  if (code === 'fulfillment_not_found') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.fulfillmentNotFound, message: 'SocketRelay fulfillment not found.' },
      { status: 404 },
    );
  }

  if (code === 'profile_not_found') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.profileNotFound, message: 'SocketRelay profile not found.' },
      { status: 404 },
    );
  }

  if (code === 'not_owner') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.notOwner, message: 'Operation requires ownership.' },
      { status: 403 },
    );
  }

  if (code === 'request_not_claimable') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.requestNotClaimable, message: 'Request is not claimable.' },
      { status: 409 },
    );
  }

  if (code === 'request_expired') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.requestExpired, message: 'This request has expired. The person who posted it can re-post it.' },
      { status: 409 },
    );
  }

  if (code === 'request_not_repostable') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.requestNotRepostable, message: 'This request has an active helper — resolve the Direct Line before re-posting.' },
      { status: 409 },
    );
  }

  // Resolve-flow errors from resolveFulfillment. Without these, an authorization denial (a helper trying
  // to resolve) and a conflict (resolving an already-resolved fulfillment) both fell through to the 503
  // default branch — reporting an authz/conflict as a server outage and firing a spurious error alert.
  if (code === 'actor_not_requester') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.actorNotRequester, message: 'Only the person who posted this request can resolve it.' },
      { status: 403 },
    );
  }

  if (code === 'fulfillment_not_active') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.fulfillmentNotActive, message: 'This Direct Line is already resolved.' },
      { status: 409 },
    );
  }

  if (code === 'invalid_outcome') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidOutcome, message: 'Choose how to resolve this request.' },
      { status: 400 },
    );
  }

  if (code === 'actor_is_owner') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.actorIsOwner, message: 'Request owner cannot claim fulfillment.' },
      { status: 403 },
    );
  }

  if (code === 'actor_not_participant') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.actorNotParticipant, message: 'Not a fulfillment participant.' },
      { status: 403 },
    );
  }

  if (code === 'prohibited_content_detected') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.prohibitedContent, message: 'Message rejected by moderation policy.' },
      { status: 400 },
    );
  }

  if (code === 'invalid payload') {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid payload.' },
      { status: 400 },
    );
  }

  reportError(error, { area: 'socket-relay', op: 'unknown' });
  return NextResponse.json(
    { ok: false, code: SOCKET_RELAY_ERROR_CODE.persistenceUnavailable, message: fallbackMessage },
    { status: 503 },
  );
}
