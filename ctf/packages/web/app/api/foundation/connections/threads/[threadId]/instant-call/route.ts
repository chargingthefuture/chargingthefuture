import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { ringInstantCall } from 'lib/foundation/instant-call';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

type RingInput = {
  authorizedBlocks?: number;
};

// Place an instant 1:1 call ring (Foundation "Connect now", issue #808 tasks 3 and 4). The caller is a
// participant of an existing Direct Line thread; this rings the other participant (the provider). Audio
// only for v1. The ring is in-app only — the callee learns about it by polling the incoming-call inbox.
// Ringing moves NO money; the buyer pre-authorizes a maximum number of blocks here (authorizedBlocks, the
// per-session cap the call can never extend past in v1), and the ring is rejected up front if the caller
// cannot even afford the first block at the provider's current rate. Push (task 5) is not done here.
export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { threadId } = await context.params;
  if (!threadId) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'threadId is required.' },
      { status: 400 },
    );
  }

  // The body is optional; an absent authorizedBlocks falls back to the default cap in ringInstantCall.
  let body: RingInput = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as RingInput;
    }
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON.' },
      { status: 400 },
    );
  }
  if (body.authorizedBlocks !== undefined && typeof body.authorizedBlocks !== 'number') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'authorizedBlocks must be a number.' },
      { status: 400 },
    );
  }

  try {
    const call = await ringInstantCall({
      threadId,
      callerUserId: gate.auth.userId,
      authorizedBlocks: body.authorizedBlocks,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.instant-call.ring',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'thread',
      targetId: threadId,
      metadata: { callId: call.id, calleeUserId: call.calleeUserId, authorizedBlocks: call.authorizedBlocks },
    });

    return NextResponse.json({ ok: true, call }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';

    if (code === 'thread_not_found') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.threadNotFound, message: 'Thread not found or access denied.' },
        { status: 404 },
      );
    }
    if (code === 'invalid_authorized_blocks') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Choose a valid number of blocks to authorize.' },
        { status: 400 },
      );
    }
    if (code === 'billing_misconfigured') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.callBillingMisconfigured, message: 'This provider is not set up for paid calls right now.' },
        { status: 409 },
      );
    }
    if (code === 'insufficient_balance') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.callInsufficientFunds, message: 'You do not have enough ServiceCredits to start this call.' },
        { status: 402 },
      );
    }
    if (code === 'rate_limit_exceeded') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.rateLimitExceeded, message: 'Too many call attempts. Wait a moment and try again.' },
        { status: 429 },
      );
    }
    if (code === 'callee_busy') {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.calleeBusy, message: 'This person already has an incoming call. Try again shortly.' },
        { status: 409 },
      );
    }

    reportError(error, { area: 'foundation', op: 'connections_instant_call_ring' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not start the call.' },
      { status: 503 },
    );
  }
}
