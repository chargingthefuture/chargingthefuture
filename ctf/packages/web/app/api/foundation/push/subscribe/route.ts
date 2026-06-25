import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { saveWebPushSubscription } from 'lib/notifications/push';
import { reportError } from 'lib/observability/report';

// Save the signed-in member's Web Push subscription for one device (issue #808 task 5). A provider who
// enabled "call alerts on this device" sends the browser's PushSubscription here so the Foundation
// instant-call ring can wake their device. The member acts only on their own subscription.
//
// Secrets policy: the endpoint and keys are stored but never logged; the audit metadata records only that
// a subscription was saved, never the endpoint URL or any key material.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; userAgent?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'A subscription is required.' },
      { status: 400 },
    );
  }

  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const p256dh = typeof payload.keys?.p256dh === 'string' ? payload.keys.p256dh : null;
  const auth = typeof payload.keys?.auth === 'string' ? payload.keys.auth : null;
  const userAgent = typeof payload.userAgent === 'string' ? payload.userAgent.slice(0, 256) : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'A complete push subscription is required.' },
      { status: 400 },
    );
  }

  try {
    await saveWebPushSubscription({ userId: gate.auth.userId, endpoint, p256dh, auth, userAgent });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.push.subscribe',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'push_subscription',
      targetId: gate.auth.userId,
      metadata: { kind: 'web' },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'push_subscribe' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not save your call alerts.' },
      { status: 503 },
    );
  }
}
