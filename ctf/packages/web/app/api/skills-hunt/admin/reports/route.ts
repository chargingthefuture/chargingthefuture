import { NextResponse } from 'next/server';
import { requireSkillsHuntAdminAccess } from '../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { listOpenReports } from 'lib/skills-hunt/moderation';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import type { SkillsHuntSubmissionReportStatus } from 'lib/skills-hunt/types';

function parseStatus(value: string | null): SkillsHuntSubmissionReportStatus | null {
  if (value === 'open' || value === 'dismissed' || value === 'archived' || value === 'removed') return value;
  return null;
}

export async function GET(request: Request) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const rawStatus = new URL(request.url).searchParams.get('status');
  const status = parseStatus(rawStatus);
  // If a status filter was provided but doesn't parse, surface a 400 rather
  // than silently dropping the filter and returning the full open queue.
  if (rawStatus !== null && status === null) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'status must be open | dismissed | archived | removed' },
      { status: 400 },
    );
  }

  try {
    const items = await withDbTransaction((client) => listOpenReports(client, status));
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'list_reports', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load reports.' },
      { status: 503 },
    );
  }
}
