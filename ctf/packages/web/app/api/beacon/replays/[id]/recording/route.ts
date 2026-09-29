import { NextResponse } from 'next/server';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { isBeaconEventId } from 'lib/beacon/replays';
import { getBeaconEvent } from 'lib/beacon/repository';
import { getFreshBeaconRecordingUrl } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function notFound(message: string) {
  return NextResponse.json(
    { ok: false, code: BEACON_ERROR_CODE.notFound, message },
    { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}

// Public: send the listener to the recording of one ended broadcast. This is the address the podcast
// feed and the blog's player use, instead of the file address itself, because the file address Stream
// delivered is signed and can expire.
//
// Order: this project's own copy (a GitHub release asset, written by the archive workflow) when one
// exists, because it does not expire and Stream may delete its copy; otherwise a current address
// asked from Stream; otherwise the stored address.
//
// Not rate-limited: a video player makes several requests while seeking, and a podcast app fetches
// each episode on its own schedule. It reads one row by id and never lists anything.
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isBeaconEventId(id)) {
    return notFound('No recorded broadcast has that id.');
  }

  try {
    const event = await getBeaconEvent(id);
    if (!event || event.status !== 'ended' || !event.recordingUrl) {
      return notFound('That broadcast has no recording.');
    }
    const target = event.archivedRecordingUrl ?? (await getFreshBeaconRecordingUrl(event.id)) ?? event.recordingUrl;
    return NextResponse.redirect(target, {
      status: 302,
      // Never cached: the address it points at is the thing that expires.
      headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'replay_recording', extra: { eventId: id } });
    return NextResponse.json(
      {
        ok: false,
        code: BEACON_ERROR_CODE.persistenceUnavailable,
        message: 'The recording could not be looked up in the database. Try again shortly.',
      },
      { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }
}
