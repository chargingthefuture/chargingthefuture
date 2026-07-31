import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { emitMembershipEvent } from 'lib/feed/repository';
import type { MembershipEventType } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';

type MembershipBody = {
  userId?: string;
  pluginId?: string;
  eventType?: MembershipEventType;
  requestId?: string | null;
  traceId?: string | null;
};

function parseMembershipBody(body: MembershipBody) {
  const eventType: MembershipEventType = body.eventType === 'leave' ? 'leave' : 'join';

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
  } catch {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
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
      metadata: {
        pluginId: input.pluginId,
        eventType: input.eventType,
        requestId: input.requestId,
        traceId: input.traceId,
      },
    });

    return NextResponse.json({ ok: true, streamEmitted: result.streamEmitted }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'membership_events' });
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
      metadata: {
        pluginId: input.pluginId,
        eventType: input.eventType,
        requestId: input.requestId,
        traceId: input.traceId,
      },
    });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to emit membership event.' },
      { status: 503 },
    );
  }
}
