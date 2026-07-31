import { NextResponse } from 'next/server';
import { ensureNotificationsCsrf, requireNotificationsAccess } from '../../_lib';
import { saveWebPushSubscription } from 'lib/notifications/push';
import { NOTIFICATION_ERROR_CODE } from 'lib/notifications/types';
import { reportError } from 'lib/observability/report';

type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent: string | null };

function invalidPayload(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: NOTIFICATION_ERROR_CODE.invalidPayload, message },
    { status: 400 },
  );
}

type PushSubscriptionPayload = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; userAgent?: unknown };

// Extract and normalise the subscription fields from the raw payload. A missing/odd endpoint becomes
// an empty string and missing/odd keys become null, which the caller rejects with a 400. The user
// agent is capped at 256 characters.
function readSubscriptionFields(payload: PushSubscriptionPayload): { endpoint: string; p256dh: string | null; auth: string | null; userAgent: string | null } {
  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const p256dh = typeof payload.keys?.p256dh === 'string' ? payload.keys.p256dh : null;
  const auth = typeof payload.keys?.auth === 'string' ? payload.keys.auth : null;
  const userAgent = typeof payload.userAgent === 'string' ? payload.userAgent.slice(0, 256) : null;
  return { endpoint, p256dh, auth, userAgent };
}

// Parse and validate the push subscription body, extracting the endpoint/keys and capping the user
// agent. Returns a discriminated result so the caller keeps TypeScript narrowing.
async function parseSubscriptionRequest(request: Request): Promise<{ error: NextResponse } | { data: PushSubscriptionInput }> {
  let payload: PushSubscriptionPayload;
  try {
    payload = await request.json();
  } catch {
    return { error: invalidPayload('A subscription is required.') };
  }

  const { endpoint, p256dh, auth, userAgent } = readSubscriptionFields(payload);

  if (!endpoint || !p256dh || !auth) {
    return { error: invalidPayload('A complete push subscription is required.') };
  }

  return { data: { endpoint, p256dh, auth, userAgent } };
}

// Save the signed-in member's Web Push subscription for one device, so their opted-in notifications can
// also ping this device. Scoped to the caller's own subscription; stored in the user-global
// push_subscriptions table (shared with Foundation call alerts) — a device subscribed once receives
// any push the member has opted into. Secrets policy: the endpoint/keys are stored, never logged.
export async function POST(request: Request) {
  const csrfDeny = ensureNotificationsCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireNotificationsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const parsed = await parseSubscriptionRequest(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { endpoint, p256dh, auth, userAgent } = parsed.data;

  try {
    await saveWebPushSubscription({ userId: gate.auth.userId, endpoint, p256dh, auth, userAgent });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'push_subscribe' });
    return NextResponse.json(
      { ok: false, code: NOTIFICATION_ERROR_CODE.persistenceUnavailable, message: 'Could not save your device alerts.' },
      { status: 503 },
    );
  }
}
