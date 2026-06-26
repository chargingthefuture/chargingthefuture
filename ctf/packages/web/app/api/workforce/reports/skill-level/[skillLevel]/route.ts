import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { fetchSkillLevelReport } from 'lib/workforce/repository';
import { fetchSkillLevelDetail } from 'lib/workforce/detail';
import { reportError } from 'lib/observability/report';



export async function GET(_request: Request, { params }: { params: Promise<{ skillLevel: string }> }) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { skillLevel } = await params;

  try {
    const normalizedSkillLevel = skillLevel.toLowerCase();
    // `all` returns the full breakdown (the dashboard uses this); a specific skill level returns only its
    // own bucket plus its matched-member drilldown (`detail`). Buckets are capitalized; the lookup is
    // case-insensitive so e.g. /reports/skill-level/advanced matches. `items` is kept for back-compat.
    if (normalizedSkillLevel === 'all') {
      const items = await fetchSkillLevelReport();
      return NextResponse.json({ items }, { status: 200 });
    }
    const detail = await fetchSkillLevelDetail(skillLevel);
    const items = detail
      ? [{ bucket: detail.bucket, target: detail.target, members: detail.members, recruited: detail.recruited, gap: detail.gap }]
      : [];
    return NextResponse.json({ items, detail }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'reports_skill_level_skilllevel' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch skill-level report.' },
      { status: 503 },
    );
  }
}
