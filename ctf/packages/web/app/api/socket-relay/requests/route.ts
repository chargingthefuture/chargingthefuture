import { NextResponse } from 'next/server';
import { ensureMutationCsrf, parsePositiveInteger, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import {
  SOCKET_RELAY_DEFAULT_PAGE,
  SOCKET_RELAY_DEFAULT_PAGE_SIZE,
  SOCKET_RELAY_ERROR_CODE,
  SOCKET_RELAY_TAG_LENGTH_MESSAGE,
} from 'lib/socket-relay/constants';
import {
  createRequest,
  hasOverlongTag,
  insertSocketRelayAudit,
  isValidRequestPrice,
  listRequests,
  validateRequestInput,
} from 'lib/socket-relay/repository';
import type { SocketRelayRequestStatus } from 'lib/socket-relay/types';
import { parseRequestInput } from 'lib/socket-relay/parse-input';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const REQUEST_STATUSES: SocketRelayRequestStatus[] = ['open', 'claimed', 'closed', 'canceled'];

// Parse the optional ?status= filter: a comma-separated list of request statuses, keeping only known
// ones. Returns undefined when nothing valid was asked for, which leaves listRequests full-status.
function parseStatusFilter(raw: string | null): SocketRelayRequestStatus[] | undefined {
  if (!raw) return undefined;
  const wanted = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is SocketRelayRequestStatus =>
      (REQUEST_STATUSES as string[]).includes(value),
    );
  return wanted.length > 0 ? wanted : undefined;
}

export async function GET(request: Request) {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), SOCKET_RELAY_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), SOCKET_RELAY_DEFAULT_PAGE_SIZE);
    // Optional ?status=open (comma-separated) scopes the feed to claimable posts so resolved/claimed
    // ones don't crowd out open requests on a page. Absent/unknown values leave the full-status list.
    const statuses = parseStatusFilter(url.searchParams.get('status'));
    const response = await listRequests({ page, pageSize, statuses });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'requests' });
    return socketRelayErrorResponse(error, 'Request listing unavailable.');
  }
}

// Validate a parsed request payload. Returns an error response, or null when the payload is acceptable.
async function validateCreateRequestPayload(
  input: ReturnType<typeof parseRequestInput>,
): Promise<NextResponse | null> {
  // Answer the one payload problem a caller can act on by itself before the catch-all message below.
  if (hasOverlongTag(input.tags)) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: SOCKET_RELAY_TAG_LENGTH_MESSAGE },
      { status: 400 },
    );
  }

  if (!validateRequestInput(input) || !(await isValidRequestPrice(input.priceCurrency, input.priceAmount))) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  return null;
}

// Use the caller-supplied idempotency key when present and non-empty, otherwise derive one.
function resolveIdempotencyKey(body: Record<string, unknown>, userId: string): string {
  const raw = body.idempotencyKey;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : `${userId}:${Date.now()}`;
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const input = parseRequestInput(body);
  const payloadDeny = await validateCreateRequestPayload(input);
  if (payloadDeny) {
    return payloadDeny;
  }

  const idempotencyKey = resolveIdempotencyKey(body, gate.auth.userId);

  try {
    const item = await createRequest(gate.auth.userId, gate.auth.username ?? null, input, idempotencyKey);
    await insertSocketRelayAudit({
      actorId: gate.auth.userId,
      command: 'socket-relay.request.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'request',
      targetId: item.id,
      // Evidence fields the audit contract asks for. Reaching this call proves the read-access gate and
      // the payload validation above both passed.
      metadata: { roleCheck: 'pass', payloadValidationCheck: 'pass' },
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'requests' });
    return socketRelayErrorResponse(error, 'Request create unavailable.');
  }
}
