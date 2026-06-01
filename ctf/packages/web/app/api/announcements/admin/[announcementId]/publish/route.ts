import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { publishAnnouncement } from 'lib/feed/repository';
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
    const announcement = await publishAnnouncement(gate.auth.userId, announcementId);
    return NextResponse.json({ ok: true, announcement }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error';
    const status = message === 'announcement_not_found' ? 404 : 503;
    const code = message === 'announcement_not_found' ? FEED_ERROR_CODE.notFound : FEED_ERROR_CODE.persistenceUnavailable;

    if (message !== 'announcement_not_found') {
      reportError(error, { area: 'announcements', op: 'publish', extra: { userId: gate.auth.userId, announcementId } });
    }

    return NextResponse.json(
      { ok: false, code, message: 'Unable to publish announcement.' },
      { status },
    );
  }
}
