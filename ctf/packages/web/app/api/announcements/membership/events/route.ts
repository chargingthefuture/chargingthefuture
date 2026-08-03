import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { emitMembershipEvent } from 'lib/feed/repository';
import type { MembershipEventType } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type MembershipBody = {
  userId?: string;
  pluginId?: string;
  eventType?: MembershipEventType;
  requestId?: string | null;
  traceId?: string | null;
};

// The contract lists eventType as required and only 'join' / 'leave' are valid. Returning null here
// lets the route reject anything else with a 400 instead of silently coercing it to 'join'.
function parseMembershipBody(body: MembershipBody) {
  const eventType: MembershipEventType | null =
    body.eventType === 'join' || body.eventType === 'leave' ? body.eventType : null;

  return {
    userId: typeof body.userId === 'string' ? body.userId.trim() : '',
    pluginId: typeof body.pluginId === 'string' ? body.pluginId.trim() : '',
    eventType,
    requestId: typeof body.requestId === 'string' ? body.requestId : null,
    traceId: typeof body.traceId === 'string' ? body.traceId : null,
  };
}

export async function POST(request: Request) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: MembershipBody;
  try {
    body = (await request.json()) as MembershipBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const input = parseMembershipBody(body);
  if (!input.userId || !input.pluginId) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'userId and pluginId are required.' },
      { status: 400 },
    );
  }

  if (input.eventType === null) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: "eventType must be 'join' or 'leave'." },
      { status: 400 },
    );
  }

  try {
    const result = await emitMembershipEvent({
      actorId: gate.auth.userId,
      userId: input.userId,
      pluginId: input.pluginId,
      eventType: input.eventType,
      requestId: input.requestId,
      traceId: input.traceId,
    });

    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.membership.event.emit',
      status: 'allow',
      reason: 'actor_admin',
      targetType: 'membership_event',
      targetId: input.userId,
      result: 'success',
      errorCategory: null,
      metadata: { pluginId: input.pluginId, eventType: input.eventType },
    });

    return NextResponse.json({ ok: true, streamEmitted: result.streamEmitted }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'membership_events' });
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.membership.event.emit',
      status: 'allow',
      reason: 'actor_admin',
      targetType: 'membership_event',
      targetId: input.userId,
      result: 'failure',
      errorCategory: error instanceof Error ? error.message : 'unknown_error',
      metadata: { pluginId: input.pluginId, eventType: input.eventType },
    });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to emit membership event.' },
      { status: 503 },
    );
  }
}
