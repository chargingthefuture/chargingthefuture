import { NextResponse } from 'next/server';
import { ensureMutationCsrf, parsePositiveInteger, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { TRUST_TRANSPORT_DEFAULT_PAGE, TRUST_TRANSPORT_DEFAULT_PAGE_SIZE, TRUST_TRANSPORT_ERROR_CODE, TRUST_TRANSPORT_MODES } from 'lib/trust-transport/constants';
import { createRequest, insertTrustTransportAudit, isValidRequestPrice, listRequests, validateRequestInput } from 'lib/trust-transport/repository';
import type { TrustTransportMode, TrustTransportRequestInput } from 'lib/trust-transport/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Only a real number or a non-empty numeric string becomes an amount; booleans, arrays, objects, and
// `null`/`undefined` never coerce to a price (so e.g. `true` is not read as 1).
function parsePriceAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function parseMode(value: unknown): TrustTransportMode {
  const modeValue = typeof value === 'string' ? value : 'ride';
  return (TRUST_TRANSPORT_MODES as readonly string[]).includes(modeValue)
    ? (modeValue as TrustTransportMode)
    : 'ride';
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

// Settlement value type (issue #420): a non-empty code names how the ride is settled; absent means
// none chosen. Amount is kept only as a positive finite number, so amount-less types carry no amount.
function parsePriceCurrency(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// Accepted-currencies multi-select (split settlements): keep only non-empty strings, trimmed and
// deduped. Codes are validated against the active currency catalog in the repository, where unknown
// or inactive codes are dropped rather than rejected.
function parseAcceptedCurrencies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((code): code is string => typeof code === 'string' && code.trim().length > 0)
        .map((code) => code.trim()),
    ),
  );
}

function parseRequestInput(body: Record<string, unknown>): TrustTransportRequestInput {
  return {
    mode: parseMode(body.mode),
    title: stringOrDefault(body.title, ''),
    details: stringOrDefault(body.details, ''),
    pickupCity: optionalString(body.pickupCity),
    dropoffCity: optionalString(body.dropoffCity),
    pickupGeoRedacted: optionalString(body.pickupGeoRedacted),
    dropoffGeoRedacted: optionalString(body.dropoffGeoRedacted),
    priceCurrency: parsePriceCurrency(body.priceCurrency),
    priceAmount: parsePriceAmount(body.priceAmount),
    acceptedCurrencies: parseAcceptedCurrencies(body.acceptedCurrencies),
  };
}

export async function GET(request: Request) {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const url = new URL(request.url);
    const page = parsePositiveInteger(url.searchParams.get('page'), TRUST_TRANSPORT_DEFAULT_PAGE);
    const pageSize = parsePositiveInteger(url.searchParams.get('pageSize'), TRUST_TRANSPORT_DEFAULT_PAGE_SIZE);
    const response = await listRequests({ page, pageSize, requesterUserId: gate.auth.userId });
    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'requests' });
    return trustTransportErrorResponse(error, 'Request listing unavailable.');
  }
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const input = parseRequestInput(body);
  if (!validateRequestInput(input) || !(await isValidRequestPrice(input.priceCurrency, input.priceAmount))) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
    ? body.idempotencyKey.trim()
    : `${gate.auth.userId}:${Date.now()}`;

  try {
    const item = await createRequest(gate.auth.userId, input, idempotencyKey);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.request.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'request',
      targetId: item.id,
      metadata: { mode: item.mode },
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'requests' });
    return trustTransportErrorResponse(error, 'Request create unavailable.');
  }
}
