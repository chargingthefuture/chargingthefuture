import { NextResponse } from 'next/server';
import { requireFeedReadAccess } from '../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { feedMentionTokens, isValidFeedChannel, listFeedTimeline, parsePaginationParams } from 'lib/feed/repository';
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
  const mentions = params.get('mentions');

  if (channel !== null && !isValidFeedChannel(channel)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid feed channel filter.' },
      { status: 400 },
    );
  }

  // `mentions=me` per the feed.timeline.fetch contract: only items whose body @-mentions the
  // CALLER. The handle tokens are derived server-side from the authenticated user (`@<username>`
  // and the `@user-<id token>` pseudonym) — a client-supplied handle is never accepted. `me` is
  // the only defined value, so anything else is rejected rather than silently unfiltered.
  if (mentions !== null && mentions !== 'me') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid mentions filter.' },
      { status: 400 },
    );
  }

  try {
    const payload = await listFeedTimeline(
      gate.auth.userId,
      gate.auth.role,
      pagination,
      {
        pluginId,
        channel: channel ?? 'all',
        mentionHandles:
          mentions === 'me' ? feedMentionTokens(gate.auth.username, gate.auth.userId) : null,
      },
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
