import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { publishAnnouncement } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = {
  params: Promise<{ announcementId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { announcementId } = await params;

  try {
    const announcement = await publishAnnouncement(gate.auth.userId, announcementId);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.publish',
      status: 'allow',
      reason: 'admin_authenticated',
      targetType: 'announcement',
      targetId: announcementId,
      result: 'success',
      errorCategory: null,
    });
    // The command contract (announcements.publish) declares { announcementId, status, publishedAt }
    // as output. publishedAt is the announcement's published_at timestamp.
    return NextResponse.json(
      { ok: true, announcementId: announcement.id, status: announcement.status, publishedAt: announcement.publishedAtIso },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'admin_announcementid_publish' });
    const message = error instanceof Error ? error.message : 'error';
    const status = message === 'announcement_not_found' ? 404 : 503;
    const code = message === 'announcement_not_found' ? FEED_ERROR_CODE.notFound : FEED_ERROR_CODE.persistenceUnavailable;

    // `status: 'allow'` is the policy-gate decision (the actor was an authorized admin), not the
    // operation outcome — that is carried by `result: 'failure'` below.
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.publish',
      status: 'allow',
      reason: 'admin_authenticated',
      targetType: 'announcement',
      targetId: announcementId,
      result: 'failure',
      errorCategory: message,
    });

    return NextResponse.json(
      { ok: false, code, message: `Unable to publish announcement: ${failureReason(error)}` },
      { status },
    );
  }
}
