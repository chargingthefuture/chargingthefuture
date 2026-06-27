import { NextResponse } from 'next/server';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { getTaxonomySummary } from 'lib/skills-taxonomy/repository';
import { reportError } from 'lib/observability/report';

// Public, UNAUTHENTICATED aggregate counts for the signed-out splash teaser (sectors / job titles /
// skills). Intentionally has no access gate — unlike /hierarchy, which is auth-gated and returns the
// full tree — because this returns ONLY counts of active rows: no taxonomy rows, no member data, so
// there is nothing to protect. The values are read live from the tables, so a newly added sector,
// job title, or skill shows up on the next load.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await getTaxonomySummary();
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'summary' });
    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to read taxonomy summary.',
      },
      { status: 503 },
    );
  }
}
