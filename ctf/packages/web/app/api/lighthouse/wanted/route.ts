import { NextRequest, NextResponse } from 'next/server';
import { requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { listWantedPostings } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Read-only. The demand side of LightHouse: the housing needs members chose to publish, so someone
// deciding whether to offer a place can see who is asking. There is no POST here on purpose —
// publishing is a field on the member's own profile (`POST /api/lighthouse/profile`), so a need
// lives in one place and un-publishing it is one tick of one box.

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 20);

  try {
    // Pass the reader so a posting from anyone they have blocked (or who blocked them) is left out —
    // a block hides the person, the same as it hides their listings.
    const result = await listWantedPostings({ page, pageSize, viewerUserId: gate.auth.userId });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'wanted' });
    return NextResponse.json(
      {
        ok: false,
        code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable,
        message: 'Wanted postings are unavailable right now.',
        reason: failureReason(error),
      },
      { status: 503 },
    );
  }
}
