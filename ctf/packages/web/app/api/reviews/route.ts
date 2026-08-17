import { NextResponse } from 'next/server';
import { getActiveReviews } from 'lib/reviews/reviews-data';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';

// Public, sign-in-free list of owner-curated community reviews. Read-only and
// non-sensitive, so it is readable by anyone and cacheable at the edge. CORS is
// open (`*`) on purpose: the separate marketing landing page (a different origin)
// fetches the same endpoint so both surfaces share one curated list.
const PUBLIC_CACHE = 'public, max-age=300, s-maxage=300, stale-while-revalidate=600';
const CORS_ALLOW_ORIGIN = '*';

export async function GET(request: Request) {
  // Per-IP brake against bulk scraping of the anonymous read (see lib/security/rate-limit.ts).
  const limited = enforcePublicReadRateLimit(request, 'reviews-public');
  if (limited) {
    return limited;
  }

  try {
    const reviews = getActiveReviews();
    return NextResponse.json(
      { ok: true, reviews },
      {
        headers: {
          'Cache-Control': PUBLIC_CACHE,
          'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
        },
      },
    );
  } catch (error) {
    reportError(error, { area: 'reviews', op: 'public' });
    return NextResponse.json({ ok: false, reviews: [] }, { status: 500 });
  }
}

// Preflight for cross-origin fetches from the landing page.
//
// `Access-Control-Allow-Headers` is declared defensively rather than to fix a live failure. The
// widget's own `Accept: application/json` is a CORS-safelisted request header, so it does not
// trigger a preflight at all and this handler is never reached for it. But any caller that later
// sends `Content-Type` or a custom header WOULD preflight, and would be rejected for a header this
// response never named — a failure that would look like the endpoint being down.
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
