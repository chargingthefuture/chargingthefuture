import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { removeGuestListener } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { failureReason } from 'lib/errors/failure';
import { ensureMutationCsrf, readGuestIdCookie } from '../../_lib';

// POST /api/chyme/public/leave — the signed-out listener stops listening (the page is closed or
// the listener component unmounts). Drops the guest's roster row so the spot frees at once rather
// than at the end of the presence window. Best-effort on the client; a missed call costs one
// window. The cookie stays, so the same browser keeps its one Stream identity for next time.
export async function POST(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'chyme-public-leave');
  if (limited) {
    return limited;
  }
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const guestId = readGuestIdCookie(request);
  if (!guestId) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    await removeGuestListener(guestId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'public_leave' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: `Unable to remove the listener: ${failureReason(error)}` },
      { status: 500 },
    );
  }
}
