import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { claimRequest, insertSocketRelayAudit } from 'lib/socket-relay/repository';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await params;

  try {
    const created = await claimRequest(id, gate.auth.userId);
    await insertSocketRelayAudit({
      actorId: gate.auth.userId,
      command: 'socket-relay.fulfillment.claim',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'fulfillment',
      targetId: created.fulfillment.id,
      metadata: { requestId: id },
    });
    // Notify the requester that someone offered to help — best-effort, deduped on the fulfillment id.
    // The claimer cannot be the owner (the repository rejects a self-claim), so no self-notify guard
    // is needed, but keep one for safety.
    if (created.fulfillment.requesterUserId && created.fulfillment.requesterUserId !== gate.auth.userId) {
      await notifySafe({
        userId: created.fulfillment.requesterUserId,
        sourcePlugin: 'socket-relay',
        notificationType: 'socket-relay.request.claimed',
        category: 'safety',
        summary: 'Someone offered to help with your SocketRelay request.',
        linkPath: '/apps/socket-relay',
        targetRef: created.fulfillment.id,
      });
    }
    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'requests_id_fulfill' });
    return socketRelayErrorResponse(error, 'Fulfillment claim unavailable.');
  }
}
