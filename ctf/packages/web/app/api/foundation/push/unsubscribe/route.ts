import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { deleteWebPushSubscription } from 'lib/notifications/push';
import { reportError } from 'lib/observability/report';

// Remove the signed-in member's Web Push subscription for one device (issue #808 task 5): they turned call
// alerts off on that device, or the browser revoked the subscription. The member acts only on their own
// subscription, identified by its endpoint. Secrets policy: the endpoint is never logged.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let payload: { endpoint?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'An endpoint is required.' },
      { status: 400 },
    );
  }

  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  if (!endpoint) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'An endpoint is required.' },
      { status: 400 },
    );
  }

  try {
    await deleteWebPushSubscription({ userId: gate.auth.userId, endpoint });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.push.unsubscribe',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'push_subscription',
      targetId: gate.auth.userId,
      metadata: { kind: 'web' },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'push_unsubscribe' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Could not turn off your call alerts.' },
      { status: 503 },
    );
  }
}
