import { NextResponse } from 'next/server';
import { createDispute, getTransferParties, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { auditServiceCreditsFailure, ensureMutationCsrf, requireServiceCreditsReadAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type DisputeBody = {
  transferId?: unknown;
  reason?: unknown;
};

// Transfer ids are UUIDs. Checking the shape first keeps a malformed id from reaching Postgres,
// where it would fail the query instead of answering "not found".
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DISPUTE_COMMAND = 'service-credits.dispute.create';

// Reads and checks the request body, or answers the 400 or 404 that says why it is not a dispute.
// Kept out of POST to hold its complexity down.
async function readDisputeBody(request: Request): Promise<{ transferId: string; reason: string } | NextResponse> {
  let body: DisputeBody;
  try {
    body = (await request.json()) as DisputeBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  if (typeof body.transferId !== 'string' || typeof body.reason !== 'string' || !body.transferId || !body.reason.trim()) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'transferId and reason are required.' }, { status: 400 });
  }
  if (!UUID_PATTERN.test(body.transferId)) {
    return NextResponse.json({ ok: false, code: 'service_credits_transfer_not_found', message: 'Transfer not found.' }, { status: 404 });
  }
  return { transferId: body.transferId, reason: body.reason };
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const parsed = await readDisputeBody(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const { transferId, reason } = parsed;

  try {
    // Ownership check: only a party to the transfer (its sender or recipient) may open a dispute on it.
    // Without this any authenticated member could dispute a transfer they were never part of.
    const parties = await getTransferParties(transferId);
    if (!parties) {
      return NextResponse.json({ ok: false, code: 'service_credits_transfer_not_found', message: 'Transfer not found.' }, { status: 404 });
    }
    if (parties.senderUserId !== gate.auth.userId && parties.recipientUserId !== gate.auth.userId) {
      const forbidden = new Error('dispute_forbidden');
      await auditServiceCreditsFailure({ actorId: gate.auth.userId, command: DISPUTE_COMMAND, targetType: 'transfer', targetId: transferId, error: forbidden });
      return serviceCreditsErrorResponse(forbidden, 'Dispute unavailable.');
    }

    const disputeId = await createDispute({ transferId, openedByUserId: gate.auth.userId, reason });
    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: DISPUTE_COMMAND,
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'dispute',
      targetId: disputeId,
    });

    return NextResponse.json({ ok: true, disputeId }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'disputes_create' });
    await auditServiceCreditsFailure({ actorId: gate.auth.userId, command: DISPUTE_COMMAND, targetType: 'transfer', targetId: transferId, error });
    return serviceCreditsErrorResponse(error, 'The dispute could not be opened right now. Nothing was recorded; try again in a moment.');
  }
}
