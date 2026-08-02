import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { markAnnouncementRead } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{
    announcementId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { announcementId } = await params;

  try {
    const { readAtIso: readAt } = await markAnnouncementRead(gate.auth.userId, announcementId);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.read.mark',
      status: 'allow',
      reason: 'actor_authenticated',
      targetType: 'announcement',
      targetId: announcementId,
      result: 'success',
      errorCategory: null,
    });

    // The command contract (announcements.read.mark) declares { announcementId, readAt } as output.
    return NextResponse.json({ ok: true, announcementId, readAt }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'announcementid_read' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to mark announcement as read.' },
      { status: 503 },
    );
  }
}
