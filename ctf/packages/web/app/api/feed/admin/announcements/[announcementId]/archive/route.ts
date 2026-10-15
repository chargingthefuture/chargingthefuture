import { NextResponse } from 'next/server';
import { recordFeedAdminFailure, requireFeedAdminMutation } from '../../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { recordFeedAdminAudit } from 'lib/feed/audit';
import { archiveAnnouncement } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = {
  params: Promise<{ announcementId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { announcementId } = await params;
  const audit = { command: 'feed.announcement.archive', targetType: 'announcement', targetId: announcementId };
  const gate = await requireFeedAdminMutation(request, audit);
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const announcement = await archiveAnnouncement(gate.auth.userId, announcementId);
    await recordFeedAdminAudit({
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
    reportError(error, { area: 'feed', op: 'admin_announcements_announcementid_archive' });
    const message = error instanceof Error ? error.message : 'error';
    const status = message === 'announcement_not_found' ? 404 : 503;
    await recordFeedAdminFailure(gate.auth.userId, audit, {
      status: 'allow',
      reason: status === 404 ? 'announcement_not_found' : 'persistence_error',
      errorCategory: status === 404 ? 'not_found' : 'persistence_error',
    });
    const code = message === 'announcement_not_found' ? FEED_ERROR_CODE.notFound : FEED_ERROR_CODE.persistenceUnavailable;

    return NextResponse.json(
      { ok: false, code, message: `Unable to archive announcement: ${failureReason(error)}` },
      { status },
    );
  }
}
