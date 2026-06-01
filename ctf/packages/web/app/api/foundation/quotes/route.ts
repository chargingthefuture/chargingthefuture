import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { createQuoteRequest, insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: { threadId?: string; serviceType?: string; requestDetails?: unknown; idempotencyKey?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const threadId = payload.threadId?.trim() ?? '';
  const serviceType = payload.serviceType?.trim() ?? '';
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
      idempotencyKey: payload.idempotencyKey?.trim() ?? `${threadId}:${serviceType}`,
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

    reportError(error, { area: 'foundation', op: 'quote_request_create', extra: { userId: gate.auth.userId, threadId } });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Quote create unavailable.' },
      { status: 503 },
    );
  }
}
