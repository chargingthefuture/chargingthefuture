import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { answerInstantCall } from 'lib/foundation/instant-call';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

// Map an answer-instant-call error to the matching HTTP response. Unknown errors are reported and
// surfaced as a 503.
function mapAnswerError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : '';
  if (code === 'call_not_found') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callNotFound, message: 'Call not found or access denied.' },
      { status: 404 },
    );
  }
  if (code === 'not_callee') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callNotCallee, message: 'Only the person being called can answer.' },
      { status: 403 },
    );
  }
  if (code === 'not_ringing') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callNotRinging, message: 'This call is no longer ringing.' },
      { status: 409 },
    );
  }
  if (code === 'caller_insufficient_funds') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callInsufficientFunds, message: 'The caller does not have enough ServiceCredits — the call was not started.' },
      { status: 402 },
    );
  }
  if (code === 'billing_misconfigured') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callBillingMisconfigured, message: 'Paid calls are not set up for this call right now.' },
      { status: 409 },
    );
  }
  reportError(error, { area: 'foundation', op: 'connections_instant_call_answer' });
  return NextResponse.json(
    { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not answer the call.' },
    { status: 503 },
  );
}

// Answer a ringing instant 1:1 call (Foundation "Connect now", issue #808 tasks 3 and 4). Only the callee
// may answer, and only while it is still ringing. Answering both moves the call into the in-call
// ('answered') state AND takes the first per-block charge from the caller to the provider, inside
// answerInstantCall. If the caller cannot afford the first block the call is ended cleanly (no money moves)
// and this route returns a clear 402 — the call is never opened.
export async function POST(request: Request, context: { params: Promise<{ callId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { callId } = await context.params;
  if (!callId) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'callId is required.' },
      { status: 400 },
    );
  }

  try {
    const call = await answerInstantCall({ callId, calleeUserId: gate.auth.userId });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.instant-call.answer',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'call',
      targetId: callId,
      metadata: {
        callerUserId: call.callerUserId,
        blocksCharged: call.blocksCharged,
        rateCreditsLocked: call.rateCreditsLocked,
        lastTransferId: call.lastTransferId,
      },
    });

    return NextResponse.json({ ok: true, call }, { status: 200 });
  } catch (error) {
    return mapAnswerError(error);
  }
}
