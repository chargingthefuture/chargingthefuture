import { NextResponse } from 'next/server';
import { listBeaconReplays } from 'lib/beacon/repository';
import {
  BEACON_REPLAY_FEED_ITEMS,
  buildBeaconReplayFeedXml,
  toPublicBeaconReplay,
} from 'lib/beacon/replays';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

export const dynamic = 'force-dynamic';

// Public: the podcast feed of recorded broadcasts, for a feed reader or a podcast app. Served by the
// app rather than built into the blog, so a replay is in the feed the moment its recording is ready
// instead of waiting for the blog's next deploy.
export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'beacon-replay-feed');
  if (limited) {
    return limited;
  }

  try {
    const events = await listBeaconReplays(BEACON_REPLAY_FEED_ITEMS, 0);
    const xml = buildBeaconReplayFeedXml(events.map(toPublicBeaconReplay), new Date());
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'replay_feed' });
    return new NextResponse('The recorded-broadcast feed could not be read from the database. Try again shortly.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300' },
    });
  }
}
