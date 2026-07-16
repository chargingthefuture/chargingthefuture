import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getPublicRoomLiveState } from 'lib/chyme/repository';
import { createChymeGuestListenCredentials } from 'lib/chyme/stream';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

// Public, unauthenticated view of the one default Chyme room so a signed-out visitor can listen in.
// Chyme's promise is "free to listen, sign in to speak", so this route returns whether the room is
// live and, when it is, a guest Stream identity to receive the audio. Speaking still requires a
// signed-in account (the guest client joins muted with no speak controls).
//
// Abuse surface: this mints a billable Stream guest identity for anonymous callers, so it could be
// hammered to burn participant-minutes. It is bounded today by (1) only minting when the room is
// actually live and (2) a short-lived (1h) guest token (see createChymeGuestListenCredentials). A
// per-process per-IP rate limit below (lib/security/rate-limit.ts) — a shared-store limit remains
// the next step if guest minutes become material; see also the documented limitation in
// ctf/docs/quota-impact/2026-06-19-chyme-guest-listen.md.
export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'chyme-public-room');
  if (limited) {
    return limited;
  }

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
