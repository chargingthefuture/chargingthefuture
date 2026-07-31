import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE, FOUNDATION_QUOTE_STATES } from 'lib/foundation/constants';
import { insertFoundationAudit, updateQuoteRequestState } from 'lib/foundation/repository';
import type { FoundationQuoteState } from 'lib/foundation/types';
import { reportError } from 'lib/observability/report';

type StatePayload = {
  transitionTo?: string;
  transitionReason?: string;
  idempotencyKey?: string;
  quotedAmount?: unknown;
  quotedCurrency?: unknown;
};

type ParsedStatePayload = { transitionTo: string; quotedAmount: number; quotedCurrency: string };

// Read the request fields we validate: the trimmed transition target, the quoted amount (NaN when not a
// number), and the trimmed quoted currency ('' when absent).
function parseStatePayload(payload: StatePayload): ParsedStatePayload {
  return {
    transitionTo: payload.transitionTo?.trim() ?? '',
    quotedAmount: typeof payload.quotedAmount === 'number' ? payload.quotedAmount : NaN,
    quotedCurrency: typeof payload.quotedCurrency === 'string' ? payload.quotedCurrency.trim() : '',
  };
}

// Validate the transition request. quoteRequestId and a known transitionTo are always required. On the
// 'provider_responded' transition the provider attaches a price: a finite quotedAmount >= 0 and a
// non-empty quotedCurrency (a code from the shared currency catalog). Only the provider may do this;
// that ownership check is enforced in the repository. Returns a 400 response on the first shape error,
// otherwise null.
function validateStatePayload(quoteRequestId: string, parsed: ParsedStatePayload): NextResponse | null {
  if (!quoteRequestId || !FOUNDATION_QUOTE_STATES.includes(parsed.transitionTo as FoundationQuoteState)) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'quoteRequestId and valid transitionTo are required.' },
      { status: 400 },
    );
  }

  if (parsed.transitionTo === 'provider_responded') {
    if (!Number.isFinite(parsed.quotedAmount) || parsed.quotedAmount < 0 || parsed.quotedCurrency.length === 0) {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'A valid quotedAmount and quotedCurrency are required to respond with a price.' },
        { status: 400 },
      );
    }
  }

  return null;
}

// Use the caller-supplied idempotency key when present; otherwise fall back to the deterministic key.
function resolveIdempotencyKey(provided: string | undefined, fallback: string): string {
  return provided?.trim() ?? fallback;
}

// Map a known repository error code to its member-facing response; returns null for anything unknown so
// the caller can report it and answer 503.
function mapQuoteStateError(error: unknown): NextResponse | null {
  const code = error instanceof Error ? error.message : '';

  if (code === 'quote_not_found') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.quoteNotFound, message: 'Quote request not found.' },
      { status: 404 },
    );
  }

  if (code === 'invalid_payload') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'A valid quotedAmount and quotedCurrency are required to respond with a price.' },
      { status: 400 },
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

  return null;
}

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

  let payload: StatePayload = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  const parsed = parseStatePayload(payload);
  const validationError = validateStatePayload(quoteRequestId, parsed);
  if (validationError) {
    return validationError;
  }

  const { transitionTo, quotedAmount, quotedCurrency } = parsed;
  const priced = transitionTo === 'provider_responded';

  try {
    const result = await updateQuoteRequestState({
      quoteRequestId,
      actorUserId: gate.auth.userId,
      targetState: transitionTo as FoundationQuoteState,
      transitionReason: payload.transitionReason,
      quotedAmount: priced ? quotedAmount : null,
      quotedCurrency: priced ? quotedCurrency : null,
      idempotencyKey: resolveIdempotencyKey(payload.idempotencyKey, `${quoteRequestId}:${transitionTo}`),
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
    const mapped = mapQuoteStateError(error);
    if (mapped) {
      return mapped;
    }

    reportError(error, { area: 'foundation', op: 'quotes_quoterequestid_state' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Quote transition unavailable.' },
      { status: 503 },
    );
  }
}
