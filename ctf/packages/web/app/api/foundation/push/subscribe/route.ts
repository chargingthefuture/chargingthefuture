import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { saveWebPushSubscription } from 'lib/notifications/push';
import { saveExpoPushSubscription } from 'lib/notifications/expo-push';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type PushSubscribePayload = {
  kind?: unknown;
  token?: unknown;
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  userAgent?: unknown;
};

// Expo native push (Android): the body carries an Expo push token, no encryption keys. The token is the
// device identity (stored as the endpoint). Audit metadata records only the kind, never the token.
async function handleExpoSubscription(
  payload: PushSubscribePayload,
  userId: string,
  userAgent: string | null,
): Promise<NextResponse> {
  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  if (!token) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'A push token is required.' },
      { status: 400 },
    );
  }

  try {
    await saveExpoPushSubscription({ userId, token, userAgent });

    await insertFoundationAudit({
      actorId: userId,
      command: 'foundation.push.subscribe',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'push_subscription',
      targetId: userId,
      metadata: { kind: 'expo' },
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

// Web Push (default): the body carries the browser's PushSubscription (endpoint + encryption keys).
// The endpoint and keys are stored but never logged; audit metadata records only the kind.
async function handleWebSubscription(
  payload: PushSubscribePayload,
  userId: string,
  userAgent: string | null,
): Promise<NextResponse> {
  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const p256dh = typeof payload.keys?.p256dh === 'string' ? payload.keys.p256dh : null;
  const auth = typeof payload.keys?.auth === 'string' ? payload.keys.auth : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'A complete push subscription is required.' },
      { status: 400 },
    );
  }

  try {
    await saveWebPushSubscription({ userId, endpoint, p256dh, auth, userAgent });

    await insertFoundationAudit({
      actorId: userId,
      command: 'foundation.push.subscribe',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'push_subscription',
      targetId: userId,
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

// Save the signed-in member's push subscription for one device. A provider who enabled "call alerts on
// this device" sends their device subscription here so the Foundation instant-call ring can wake their
// device. The member acts only on their own subscription.
//
// Two kinds of subscription share this one route, branched on the body's `kind`:
//   - Web Push (default / kind:'web', issue #808 task 5): the browser's PushSubscription — endpoint + the
//     p256dh/auth encryption keys.
//   - Expo native push (kind:'expo', issue #884): the Android app's Expo push token. The token is the
//     identity (stored as the endpoint); there are no encryption keys.
// Both store into the same user-global push_subscriptions table on (user_id, endpoint), so the same
// account/service deletion wiring removes either kind.
//
// Secrets policy: the endpoint/token and any keys are stored but never logged; the audit metadata records
// only the kind, never the endpoint URL, token, or any key material.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: PushSubscribePayload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'A subscription is required.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const userAgent = typeof payload.userAgent === 'string' ? payload.userAgent.slice(0, 256) : null;
  const kind = payload.kind === 'expo' ? 'expo' : 'web';

  if (kind === 'expo') {
    return handleExpoSubscription(payload, gate.auth.userId, userAgent);
  }

  return handleWebSubscription(payload, gate.auth.userId, userAgent);
}
