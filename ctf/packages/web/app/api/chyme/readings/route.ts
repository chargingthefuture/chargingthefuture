import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getReadingsSetting } from 'lib/chyme/readings/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// GET /api/chyme/readings — public, unauthenticated. Whether the readings loop is switched on. Read
// by the Chyme page (signed out and signed in) while nobody is live; when on, the page reads the
// playlist from the blog's own list (BLOG_READINGS_URL in lib/chyme/readings/schedule.ts).
export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'chyme-readings');
  if (limited) return limited;

  try {
    const setting = await getReadingsSetting();
    return NextResponse.json({ ok: true, enabled: setting.enabled });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'readings_public' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Unable to read the readings switch: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
