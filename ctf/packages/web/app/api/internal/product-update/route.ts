import { NextRequest, NextResponse } from 'next/server';
import { createAnnouncementDraft, publishAnnouncement } from 'lib/feed/repository';
import { logFeedAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const CI_ACTOR_ID = 'ci-product-update';

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    // 503 (not 501): the route exists but is unconfigured in this runtime. 503 lets the caller
    // distinguish a misconfiguration from a wrong credential (401), matching the account/delete route.
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let title: string, body: string;
  try {
    const data = (await request.json()) as { title?: unknown; body?: unknown };
    title = typeof data.title === 'string' ? data.title.trim() : '';
    body = typeof data.body === 'string' ? data.body.trim() : '';
  } catch (caught) {
    return NextResponse.json({ error: 'Invalid JSON', reason: failureReason(caught) }, { status: 400 });
  }

  if (!title || !body) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 });
  }

  try {
    const draft = await createAnnouncementDraft(CI_ACTOR_ID, { title, body });
    const announcement = await publishAnnouncement(CI_ACTOR_ID, draft.id);

    logFeedAudit({
      actorId: CI_ACTOR_ID,
      pluginId: 'feed',
      command: 'feed.announcement.publish',
      status: 'allow',
      reason: 'ci_product_update',
      targetType: 'announcement',
      targetId: announcement.id,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ id: announcement.id, status: 'published' }, { status: 201 });
  } catch (err) {
    reportError(err, { area: 'internal', op: 'product_update' });
    return NextResponse.json({ error: 'Failed to publish', detail: failureReason(err) }, { status: 503 });
  }
}
