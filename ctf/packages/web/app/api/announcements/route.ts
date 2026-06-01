import { NextResponse } from 'next/server';
import { requireFeedReadAccess } from '../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { listAnnouncements } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const announcements = await listAnnouncements(false);
    return NextResponse.json({ items: announcements }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'announcements', op: 'index' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch announcements.' },
      { status: 503 },
    );
  }
}
