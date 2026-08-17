import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { dismissAnnouncement } from 'lib/feed/repository';
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
    const { dismissedAtIso } = await dismissAnnouncement(gate.auth.userId, announcementId);

    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.dismiss',
      status: 'allow',
      reason: 'dismiss_allowed',
      targetType: 'announcement',
      targetId: announcementId,
      result: 'success',
      errorCategory: null,
    });

    // The command contract (announcements.dismiss) declares { announcementId, dismissedAt } as output.
    return NextResponse.json({ ok: true, announcementId, dismissedAt: dismissedAtIso }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'announcementid_dismiss' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to dismiss announcement.' },
      { status: 503 },
    );
  }
}
