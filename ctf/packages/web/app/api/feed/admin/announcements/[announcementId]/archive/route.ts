import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { archiveAnnouncement } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';

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
    const announcement = await archiveAnnouncement(gate.auth.userId, announcementId);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.announcement.archive',
      status: 'allow',
      reason: 'admin_archive_allowed',
      targetType: 'announcement',
      targetId: announcement.id,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error';
    const status = message === 'announcement_not_found' ? 404 : 503;
    const code = message === 'announcement_not_found' ? FEED_ERROR_CODE.notFound : FEED_ERROR_CODE.persistenceUnavailable;

    if (message !== 'announcement_not_found') {
      reportError(error, { area: 'feed', op: 'archive_announcement', extra: { userId: gate.auth.userId, announcementId } });
    }

    return NextResponse.json(
      { ok: false, code, message: 'Unable to archive announcement.' },
      { status },
    );
  }
}
