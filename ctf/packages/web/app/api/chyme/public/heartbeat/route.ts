import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { touchGuestPresence } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { failureReason } from 'lib/errors/failure';
import { ensureMutationCsrf, readGuestIdCookie } from '../../_lib';

// POST /api/chyme/public/heartbeat — the signed-out listener's presence keepalive.
//
// The listener page calls this every 35s while it is in the call, the same cadence as a member's
// heartbeat, so the guest keeps counting as listening (the guest cap reads that count) and the
// minute meter is credited for the time. The guest is identified by the cookie the listen route
// set; a request without it has nothing to keep alive and is answered 400. A guest whose row was
// pruned answers 404 so the page can re-admit itself through the listen route.
export async function POST(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'chyme-public-heartbeat');
  if (limited) {
    return limited;
  }
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const guestId = readGuestIdCookie(request);
  if (!guestId) {
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.guestIdentityMissing, message: 'No listener identity was sent; tap to listen again.' },
      { status: 400 },
    );
  }

  try {
    const touched = await touchGuestPresence(guestId);
    if (!touched) {
      return NextResponse.json(
        { ok: false, code: CHYME_ERROR_CODE.guestIdentityMissing, message: 'This listener is no longer on the roster; tap to listen again.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'public_heartbeat' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: `Unable to refresh the listener's presence: ${failureReason(error)}` },
      { status: 500 },
    );
  }
}
