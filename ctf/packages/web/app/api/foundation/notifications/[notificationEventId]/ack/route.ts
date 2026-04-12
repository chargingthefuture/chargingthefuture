import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { ackNotificationEvent, insertFoundationAudit } from 'lib/foundation/repository';

export async function POST(request: Request, context: { params: Promise<{ notificationEventId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { notificationEventId } = await context.params;
  if (!notificationEventId) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'notificationEventId is required.' },
      { status: 400 },
    );
  }

  try {
    const updated = await ackNotificationEvent({
      actorUserId: gate.auth.userId,
      notificationEventId,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.notificationNotFound, message: 'Notification event not found.' },
        { status: 404 },
      );
    }

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.notification.event.ack',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'notification_event',
      targetId: notificationEventId,
      metadata: {},
    });

    return NextResponse.json({ ok: true, notification: updated }, { status: 200 });
  } catch (error) {
    console.error('[Foundation] Notification ack failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Notification ack unavailable.' },
      { status: 503 },
    );
  }
}
