import { NextResponse } from 'next/server';
import { countBeaconReplays, listBeaconReplays } from 'lib/beacon/repository';
import {
  BEACON_PUBLIC_READ_HEADERS,
  BEACON_REPLAY_FEED_URL,
  BEACON_REPLAY_PAGE_SIZE,
  toPublicBeaconReplay,
} from 'lib/beacon/replays';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: BEACON_PUBLIC_READ_HEADERS });
}

// Public: every recorded broadcast, newest first, one page at a time. The blog's streams page reads
// this from the browser. No sign-in, because each replay here is already watchable by anybody on
// /apps/beacon and was announced in the Commons when it was posted.
//
// `?page=` is 1-based and clamped into range, so an out-of-range page answers with the last page
// rather than nothing.
export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'beacon-replays');
  if (limited) {
    return limited;
  }

  const requested = Number.parseInt(new URL(request.url).searchParams.get('page') ?? '1', 10);

  try {
    const total = await countBeaconReplays();
    const pageCount = Math.max(1, Math.ceil(total / BEACON_REPLAY_PAGE_SIZE));
    const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pageCount);
    const events = await listBeaconReplays(BEACON_REPLAY_PAGE_SIZE, (page - 1) * BEACON_REPLAY_PAGE_SIZE);
    return NextResponse.json(
      {
        ok: true,
        page,
        pageCount,
        pageSize: BEACON_REPLAY_PAGE_SIZE,
        total,
        feedUrl: BEACON_REPLAY_FEED_URL,
        replays: events.map(toPublicBeaconReplay),
      },
      { status: 200, headers: BEACON_PUBLIC_READ_HEADERS },
    );
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'replays_list' });
    return NextResponse.json(
      {
        ok: false,
        code: BEACON_ERROR_CODE.persistenceUnavailable,
        message: 'The list of recorded broadcasts could not be read from the database. Try again shortly.',
      },
      { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }
}
