import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { ChymeGuestListenError, admitGuestListener } from 'lib/chyme/repository';
import { createChymeGuestListenCredentials } from 'lib/chyme/stream';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { describeStreamError } from 'lib/shared/stream-error-text';
import { failureReason } from 'lib/errors/failure';
import { ensureMutationCsrf, readGuestIdCookie, setGuestIdCookie } from '../../_lib';

// POST /api/chyme/public/listen — a signed-out visitor taps "Tap to listen".
//
// Public and unauthenticated, like the room read, but a write in three ways: it mints a billable
// Stream guest identity, it takes one of the guest listening spots, and it sets the browser's guest
// cookie. So it takes the same same-origin CSRF header the member mutations take, is rate limited
// per IP, and answers with a plain reason when the visitor cannot listen right now (the room is not
// live, guests are paused by the quota policy, or every spot is taken).
//
// The guest id is one random value per browser, from the httpOnly cookie this route sets on the
// first tap; the Stream user is `chyme-guest-<id>`, so a returning browser reuses one Stream user
// instead of minting a new one per page load.
export async function POST(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'chyme-public-listen');
  if (limited) {
    return limited;
  }
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const existingGuestId = readGuestIdCookie(request);
  const guestId = existingGuestId ?? randomUUID();
  // The cookie is set on every answer that carries the browser's new id — a refusal included, so
  // the retry a minute later is the same guest and not a second one.
  const withCookie = (response: NextResponse): NextResponse => {
    if (!existingGuestId) {
      setGuestIdCookie(response, guestId);
    }
    return response;
  };

  let state: Awaited<ReturnType<typeof admitGuestListener>>;
  try {
    state = await admitGuestListener(guestId);
  } catch (error) {
    if (error instanceof ChymeGuestListenError) {
      return withCookie(refusalResponse(error));
    }
    reportError(error, { area: 'chyme', op: 'public_listen_admit' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Unable to admit a listener: ${failureReason(error)}` },
      { status: 503 },
    );
  }

  const minted = await mintGuestCredentials(guestId);
  if (!minted.credentials) {
    return withCookie(
      NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.streamUnavailable, message: minted.reason, isLive: true }, { status: 503 }),
    );
  }
  return withCookie(
    NextResponse.json(
      { ok: true, isLive: true, participantCount: state.participantCount, guestCount: state.guestCount, credentials: minted.credentials },
      { status: 200 },
    ),
  );
}

// 409 for a spot that may free up (full, or the room went quiet between the read and the tap);
// 503 while the policy has guests paused for the rest of the month. Each carries the plain reason.
function refusalResponse(error: ChymeGuestListenError): NextResponse {
  const code =
    error.kind === 'paused'
      ? CHYME_ERROR_CODE.guestListenPaused
      : error.kind === 'full'
        ? CHYME_ERROR_CODE.guestListenFull
        : CHYME_ERROR_CODE.persistenceUnavailable;
  return NextResponse.json(
    { ok: false, code, message: error.message, isLive: error.kind !== 'not_live' },
    { status: error.kind === 'paused' ? 503 : 409 },
  );
}

// The Stream-side step, kept apart from the admission so a Stream refusal is reported as exactly
// that (Stream's own reason, api key redacted) and never as "no room".
async function mintGuestCredentials(
  guestId: string,
): Promise<{ credentials: Awaited<ReturnType<typeof createChymeGuestListenCredentials>>; reason: string }> {
  try {
    const credentials = await createChymeGuestListenCredentials(guestId);
    return { credentials, reason: credentials ? '' : 'Stream is not configured for this environment.' };
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'public_listen_guest_credentials' });
    return { credentials: null, reason: describeStreamError(error) };
  }
}
