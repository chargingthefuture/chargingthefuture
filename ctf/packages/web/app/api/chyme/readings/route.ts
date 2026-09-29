import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getReadingsSetting, listReadingsTracks } from 'lib/chyme/readings/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// GET /api/chyme/readings — public, unauthenticated. Whether the readings loop is on, and its
// playlist when it is. Read by the Chyme page (signed out and signed in) while nobody is live. The
// tracks are the owner's own recordings of already-published blog posts, so nothing here is private;
// when the loop is off the list is left out entirely.
export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'chyme-readings');
  if (limited) return limited;

  try {
    const setting = await getReadingsSetting();
    if (!setting.enabled) return NextResponse.json({ ok: true, enabled: false, tracks: [] });
    const tracks = await listReadingsTracks();
    return NextResponse.json({ ok: true, enabled: true, tracks });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'readings_public' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Unable to load the readings: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
