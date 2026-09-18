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

// The Stream error, trimmed for the page. Stream's messages name the failing call and its reason
// ("UpdateUsers failed with error: ...") and carry no secret; the cap keeps a runaway message from
// becoming the whole screen.
function describeGuestCredentialError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

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
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: 'Unable to load the public room.' },
      { status: 503 },
    );
  }

  if (!state.callActive) {
    return NextResponse.json({ ok: true, roomName: state.roomName, isLive: false, participantCount: 0 });
  }

  // The room is live. Minting the guest identity is a separate, Stream-side step, and a failure
  // there is reported as exactly that — never as "no room". Before this split, one catch covered
  // both, so a rejected guest upsert (a role name Stream does not know, a Stream outage) came back
  // as a 503 and the page showed "No public rooms right now" while a member was audibly in the
  // call. The visitor could not tell, and neither could the person they reported it to.
  let credentials: Awaited<ReturnType<typeof createChymeGuestListenCredentials>> = null;
  let listenUnavailable: string | undefined;
  try {
    credentials = await createChymeGuestListenCredentials();
    if (!credentials) {
      listenUnavailable = 'Stream is not configured for this environment.';
    }
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'public_room_guest_credentials' });
    listenUnavailable = describeGuestCredentialError(error);
  }

  return NextResponse.json({
    ok: true,
    roomName: state.roomName,
    isLive: true,
    participantCount: state.participantCount,
    // Present only when Stream is configured and the guest identity was minted.
    credentials: credentials ?? undefined,
    // Present only when the room is live but the visitor cannot be given a way to listen: the
    // plain reason, for the page to show under the room heading.
    listenUnavailable,
  });
}
