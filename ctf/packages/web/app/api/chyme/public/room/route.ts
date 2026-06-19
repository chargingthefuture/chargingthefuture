import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getPublicRoomLiveState } from 'lib/chyme/repository';
import { createChymeGuestListenCredentials } from 'lib/chyme/stream';
import { reportError } from 'lib/observability/report';

// Public, unauthenticated view of the one default Chyme room so a signed-out visitor can listen in.
// Chyme's promise is "free to listen, sign in to speak", so this route returns whether the room is
// live and, when it is, a guest Stream identity to receive the audio. Speaking still requires a
// signed-in account (the guest client joins muted with no speak controls).
export async function GET() {
  try {
    const state = await getPublicRoomLiveState();

    // Only hand out a guest listen token when there is actually a live call to join — no point
    // connecting a guest (and incurring Stream participant-minutes) to a silent room.
    const credentials = state.callActive ? await createChymeGuestListenCredentials() : null;

    return NextResponse.json({
      ok: true,
      roomName: state.roomName,
      isLive: state.callActive,
      participantCount: state.participantCount,
      // Present only when the room is live and Stream is configured.
      credentials: credentials ?? undefined,
    });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'public_room' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: 'Unable to load the public room.' },
      { status: 503 },
    );
  }
}
