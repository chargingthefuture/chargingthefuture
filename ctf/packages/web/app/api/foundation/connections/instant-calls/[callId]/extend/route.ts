import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { extendInstantCall } from 'lib/foundation/instant-call';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

// Map an extend-instant-call error to the matching HTTP response. Unknown errors are reported and
// surfaced as a 503.
function mapExtendError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : '';
  if (code === 'call_not_found') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callNotFound, message: 'Call not found or access denied.' },
      { status: 404 },
    );
  }
  if (code === 'not_caller') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callNotCaller, message: 'Only the person who started the call can extend it.' },
      { status: 403 },
    );
  }
  if (code === 'not_active') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callNotActive, message: 'This call is not active.' },
      { status: 409 },
    );
  }
  if (code === 'block_cap_reached') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callBlockCapReached, message: 'You have reached the number of blocks you authorized for this call.' },
      { status: 409 },
    );
  }
  if (code === 'caller_insufficient_funds') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callInsufficientFunds, message: 'You do not have enough ServiceCredits — the call has ended.' },
      { status: 402 },
    );
  }
  if (code === 'billing_misconfigured') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.callBillingMisconfigured, message: 'Paid calls are not set up for this call right now.' },
      { status: 409 },
    );
  }
  reportError(error, { area: 'foundation', op: 'connections_instant_call_extend' });
  return NextResponse.json(
    { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not extend the call.' },
    { status: 503 },
  );
}

// Extend an in-progress instant 1:1 call by one more paid block (Foundation "Connect now", issue #808
// task 4). Caller-only: only the buyer who started the call can authorize another block. The call must be
// active and still under the buyer-set block cap chosen at ring time. The next block is charged at the
// rate LOCKED on the call at answer (never the provider's live rate), through the canonical peer-to-peer
// transfer primitive, which is idempotent per block so a retry never double-charges. On insufficient funds
// the call ends cleanly (no money moves) and this returns a 402; past the cap it returns a 409.
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
    const call = await extendInstantCall({ callId, callerUserId: gate.auth.userId });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.connection.instant-call.extend',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'call',
      targetId: callId,
      metadata: {
        calleeUserId: call.calleeUserId,
        blocksCharged: call.blocksCharged,
        authorizedBlocks: call.authorizedBlocks,
        rateCreditsLocked: call.rateCreditsLocked,
        lastTransferId: call.lastTransferId,
      },
    });

    return NextResponse.json({ ok: true, call }, { status: 200 });
  } catch (error) {
    return mapExtendError(error);
  }
}
