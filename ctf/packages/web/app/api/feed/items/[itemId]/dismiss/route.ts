import { NextResponse } from 'next/server';
import { requireFeedReadAccess, ensureMutationCsrf } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { dismissFeedItem } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{
    itemId: string;
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

  const { itemId } = await params;

  try {
    const { dismissedAtIso } = await dismissFeedItem(gate.auth.userId, itemId);

    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.item.dismiss',
      status: 'allow',
      reason: 'dismiss_allowed',
      targetType: 'feed_item',
      targetId: itemId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, itemId, dismissedAt: dismissedAtIso }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'items_itemid_dismiss' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to dismiss feed item.' },
      { status: 503 },
    );
  }
}
