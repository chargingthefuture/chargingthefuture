import { NextRequest, NextResponse } from 'next/server';
import { createAnnouncementDraft, publishAnnouncement } from 'lib/feed/repository';
import { logFeedAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';

const CI_ACTOR_ID = 'ci-product-update';

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 501 });
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
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
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
  } catch (error) {
    reportError(error, { area: 'internal', op: 'post_product_update_publish', extra: { actorId: CI_ACTOR_ID } });
    const message = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ error: 'Failed to publish', detail: message }, { status: 503 });
  }
}
