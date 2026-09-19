import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getPublicRoomLiveState } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { failureReason } from 'lib/errors/failure';

// Public, unauthenticated view of the one default Chyme room so a signed-out visitor can see whether
// it is live. Chyme's promise is "free to listen, sign in to speak": this route says whether there is
// something to listen to and whether listening is open right now; the listen credentials themselves
// come from POST /api/chyme/public/listen when the visitor taps (2026-09-19). Until then every page
// load minted a fresh Stream guest user here, before the visitor had tapped anything — a candidate
// monthly-active user on the Chat meter per load. A read now touches nothing on Stream.
export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'chyme-public-room');
  if (limited) {
    return limited;
  }

  let state: Awaited<ReturnType<typeof getPublicRoomLiveState>>;
  try {
    state = await getPublicRoomLiveState();
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'public_room' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Unable to load the public room: ${failureReason(error)}` },
      { status: 503 },
    );
  }

  if (!state.callActive) {
    return NextResponse.json({ ok: true, roomName: state.roomName, isLive: false, participantCount: 0, guestCount: 0 });
  }

  // The room is live. Whether a guest can listen is the quota policy's call: while guests are
  // paused (Orange band and above) the page shows the reason in place of the listen button.
  const guestListenAllowed = state.policy.guestListenAllowed;
  return NextResponse.json({
    ok: true,
    roomName: state.roomName,
    isLive: true,
    participantCount: state.participantCount,
    guestCount: state.guestCount,
    guestListenAllowed,
    // Present only when the room is live but the visitor cannot be given a way to listen: the plain
    // reason, for the page to show under the room heading.
    listenUnavailable: guestListenAllowed ? undefined : state.policy.guestPausedReason ?? undefined,
  });
}
