import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit, upsertNotificationPreferences } from 'lib/foundation/repository';

export async function PUT(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: { inAppEnabled?: boolean; pushEnabled?: boolean; emailEnabled?: boolean; quietHours?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  if (typeof payload.inAppEnabled !== 'boolean' || typeof payload.pushEnabled !== 'boolean') {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'inAppEnabled and pushEnabled booleans are required.' },
      { status: 400 },
    );
  }

  try {
    const preferences = await upsertNotificationPreferences({
      actorUserId: gate.auth.userId,
      inAppEnabled: payload.inAppEnabled,
      pushEnabled: payload.pushEnabled,
      emailEnabled: payload.emailEnabled,
      quietHours: payload.quietHours,
    });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.notification.preferences.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'notification_preferences',
      targetId: gate.auth.userId,
      metadata: { effectiveChannels: preferences.effectiveChannels },
    });

    return NextResponse.json({ ok: true, ...preferences }, { status: 200 });
  } catch (error) {
    console.error('[Foundation] Notification preferences update failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Notification preferences unavailable.' },
      { status: 503 },
    );
  }
}
