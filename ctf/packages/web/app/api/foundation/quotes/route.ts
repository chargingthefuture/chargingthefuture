import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { createQuoteRequest, insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

type CreateQuotePayload = { threadId?: string; serviceType?: string; requestDetails?: unknown; idempotencyKey?: string };

// Trim an optional string field to a plain string ('' when absent).
function trimmed(value: string | undefined): string {
  return value?.trim() ?? '';
}

// Use the caller-supplied idempotency key when present; otherwise fall back to the deterministic key.
function resolveIdempotencyKey(provided: string | undefined, fallback: string): string {
  return provided?.trim() ?? fallback;
}

// Map a known repository error code to its member-facing response; returns null for anything unknown so
// the caller can report it and answer 503.
function mapCreateQuoteError(error: unknown): NextResponse | null {
  const code = error instanceof Error ? error.message : '';

  if (code === 'thread_not_found') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.threadNotFound, message: 'Thread not found.' },
      { status: 404 },
    );
  }

  if (code === 'policy_denied') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.policyDenied, message: 'Quote create denied by policy.' },
      { status: 403 },
    );
  }

  if (code === 'rate_limit_exceeded') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.rateLimitExceeded, message: 'Quote create rate limit exceeded.' },
      { status: 429 },
    );
  }

  return null;
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: CreateQuotePayload = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const threadId = trimmed(payload.threadId);
  const serviceType = trimmed(payload.serviceType);
  if (!threadId || !serviceType) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'threadId and serviceType are required.' },
      { status: 400 },
    );
  }

  try {
    const quote = await createQuoteRequest({
      threadId,
      actorUserId: gate.auth.userId,
      serviceType,
      requestDetails: payload.requestDetails,
      idempotencyKey: resolveIdempotencyKey(payload.idempotencyKey, `${threadId}:${serviceType}`),
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.quote.request.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'quote_request',
      targetId: quote.id,
      metadata: { threadId, serviceType },
    });

    return NextResponse.json({ ok: true, quote }, { status: 201 });
  } catch (error) {
    const mapped = mapCreateQuoteError(error);
    if (mapped) {
      return mapped;
    }

    reportError(error, { area: 'foundation', op: 'quotes' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Quote create unavailable.' },
      { status: 503 },
    );
  }
}
