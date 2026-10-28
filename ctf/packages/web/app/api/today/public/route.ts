import { NextResponse } from 'next/server';
import { buildPublicToday } from 'lib/today/build-public';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// GET /api/today/public: Today for a visitor who is not signed in. No sign-in, limited per address,
// and nothing personal in it (lib/today/build-public.ts). Cached briefly, since every visitor reads
// the same answer.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'today-public');
  if (limited) return limited;
  try {
    const today = await buildPublicToday();
    return NextResponse.json({ ok: true, today }, { headers: { 'cache-control': 'public, max-age=30, s-maxage=60' } });
  } catch (error) {
    reportError(error, { area: 'today', op: 'build_public' });
    return NextResponse.json(
      { ok: false, code: 'TODAY_UNAVAILABLE', message: `Could not read Today: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
