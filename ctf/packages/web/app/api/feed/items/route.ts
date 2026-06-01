import { NextResponse } from 'next/server';
import { requireFeedReadAccess } from '../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { isValidFeedChannel, listFeedTimeline, parsePaginationParams } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const pagination = parsePaginationParams(request.url);
  const params = new URL(request.url).searchParams;
  const pluginId = params.get('pluginId');
  const channel = params.get('channel');

  if (channel !== null && !isValidFeedChannel(channel)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid feed channel filter.' },
      { status: 400 },
    );
  }

  try {
    const payload = await listFeedTimeline(
      gate.auth.userId,
      gate.auth.role,
      pagination,
      { pluginId, channel: channel ?? 'all' },
    );

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'items' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch feed timeline.' },
      { status: 503 },
    );
  }
}
