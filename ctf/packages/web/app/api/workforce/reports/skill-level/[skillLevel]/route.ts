import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { fetchSkillLevelReport } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';



export async function GET(_request: Request, { params }: { params: Promise<{ skillLevel: string }> }) {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { skillLevel } = await params;

  try {
    const items = await fetchSkillLevelReport();
    const normalizedSkillLevel = skillLevel.toLowerCase();
    // `all` returns the full breakdown (the dashboard uses this); a specific skill level returns only its
    // own bucket, so a single-level request never leaks the whole cross-level dataset. Output is `{ items }`
    // per the workforce.report.skillLevel.fetch contract in both cases.
    if (normalizedSkillLevel === 'all') {
      return NextResponse.json({ items }, { status: 200 });
    }
    const bucket = items.find((item) => item.bucket === normalizedSkillLevel) ?? null;
    return NextResponse.json({ items: bucket ? [bucket] : [] }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'reports_skill_level_skilllevel' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch skill-level report.' },
      { status: 503 },
    );
  }
}
