import { NextResponse } from 'next/server';
import { createDispute, getTransferParties, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsReadAccess } from 'lib/service-credits/_lib';
import { failureReason } from 'lib/errors/failure';

type DisputeBody = {
  transferId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: DisputeBody;
  try {
    body = (await request.json()) as DisputeBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  if (!body.transferId || !body.reason) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'transferId and reason are required.' }, { status: 400 });
  }

  // Ownership check: only a party to the transfer (its sender or recipient) may open a dispute on it.
  // Without this any authenticated member could dispute a transfer they were never part of.
  const parties = await getTransferParties(body.transferId);
  if (!parties) {
    return NextResponse.json({ ok: false, code: 'service_credits_transfer_not_found', message: 'Transfer not found.' }, { status: 404 });
  }
  if (parties.senderUserId !== gate.auth.userId && parties.recipientUserId !== gate.auth.userId) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_dispute_forbidden', message: 'You can only dispute a transfer you were a party to.' },
      { status: 403 },
    );
  }

  const disputeId = await createDispute({ transferId: body.transferId, openedByUserId: gate.auth.userId, reason: body.reason });
  await insertServiceCreditsAudit({
    actorId: gate.auth.userId,
    command: 'service-credits.dispute.create',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'dispute',
    targetId: disputeId,
  });

  return NextResponse.json({ ok: true, disputeId }, { status: 201 });
}
