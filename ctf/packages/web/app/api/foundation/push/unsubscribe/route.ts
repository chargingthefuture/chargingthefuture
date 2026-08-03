import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit } from 'lib/foundation/repository';
import { deletePushSubscriptionByEndpoint } from 'lib/notifications/push';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Remove the signed-in member's push subscription for one device (issue #808 task 5): they turned call
// alerts off on that device, or the browser/app revoked the subscription. The member acts only on their own
// subscription, identified by its endpoint. This route is kind-agnostic: the endpoint is either a Web Push
// endpoint URL or an Expo push token, and the deletion matches on (user_id, endpoint) regardless of kind,
// so the same call removes a web or expo row. Secrets policy: the endpoint is never logged.
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'An endpoint is required.', reason: failureReason(error) },
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
    await deletePushSubscriptionByEndpoint({ userId: gate.auth.userId, endpoint });

    // The route deletes by endpoint and does not know the row's kind, so the audit omits `kind` rather
    // than hard-coding a (possibly wrong) value.
    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.push.unsubscribe',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'push_subscription',
      targetId: gate.auth.userId,
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
