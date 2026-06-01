import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE, FOUNDATION_QUOTE_STATES } from 'lib/foundation/constants';
import { insertFoundationAudit, updateQuoteRequestState } from 'lib/foundation/repository';
import type { FoundationQuoteState } from 'lib/foundation/types';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request, context: { params: Promise<{ quoteRequestId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { quoteRequestId } = await context.params;

  let payload: { transitionTo?: string; transitionReason?: string; idempotencyKey?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const transitionTo = payload.transitionTo?.trim() ?? '';
  if (!quoteRequestId || !FOUNDATION_QUOTE_STATES.includes(transitionTo as FoundationQuoteState)) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'quoteRequestId and valid transitionTo are required.' },
      { status: 400 },
    );
  }

  try {
    const result = await updateQuoteRequestState({
      quoteRequestId,
      actorUserId: gate.auth.userId,
      targetState: transitionTo as FoundationQuoteState,
      transitionReason: payload.transitionReason,
      idempotencyKey: payload.idempotencyKey?.trim() ?? `${quoteRequestId}:${transitionTo}`,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.quote.request.state.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'quote_request',
      targetId: quoteRequestId,
      metadata: { previousState: result.previousState, currentState: result.quote.lifecycleState },
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';

    if (code === 'quote_not_found') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.quoteNotFound, message: 'Quote request not found.' },
        { status: 404 },
      );
    }

    if (code === 'invalid_quote_transition') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.invalidQuoteTransition, message: 'Invalid quote lifecycle transition.' },
        { status: 409 },
      );
    }

    if (code === 'policy_denied') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.policyDenied, message: 'Quote transition denied by policy.' },
        { status: 403 },
      );
    }

    reportError(error, { area: 'foundation', op: 'quotes_quoterequestid_state' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Quote transition unavailable.' },
      { status: 503 },
    );
  }
}
