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
    const outcome = await dismissFeedItem(gate.auth.userId, itemId);
    if (outcome === 'mandatory') {
      return NextResponse.json(
        {
          ok: false,
          code: FEED_ERROR_CODE.dismissNotAllowed,
          message: 'Mandatory feed items cannot be dismissed.',
        },
        { status: 409 },
      );
    }

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

    return NextResponse.json({ ok: true, itemId }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'dismiss_item', extra: { userId: gate.auth.userId, itemId } });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to dismiss feed item.' },
      { status: 503 },
    );
  }
}
