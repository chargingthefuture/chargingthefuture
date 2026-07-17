import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { fetchCommunityPlanningReport } from 'lib/workforce/community-planning';
import { reportError } from 'lib/observability/report';

// Read-only roster overlay for the survivor-built gated community planning document (issue #1465).
// Returns each planning team with the Directory members that already match its sectors, plus the
// team's demand gap. Behind the same read gate as every other Workforce report, so member names are
// only ever returned to a signed-in member — never published to the public repo.
export async function GET() {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const report = await fetchCommunityPlanningReport();
    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'reports_community_planning' });
    return NextResponse.json(
      {
        ok: false,
        code: WORKFORCE_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to fetch community planning report.',
      },
      { status: 503 },
    );
  }
}
