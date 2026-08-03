import { NextResponse } from 'next/server';
import { requireSkillsHuntAdminAccess } from '../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { listReports } from 'lib/skills-hunt/moderation';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import type { SkillsHuntSubmissionReportStatus } from 'lib/skills-hunt/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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
  // If a status filter was provided but doesn't parse, surface a 400 rather
  // than silently dropping the filter and returning the wrong set.
  if (rawStatus !== null && parseStatus(rawStatus) === null) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'status must be open | dismissed | archived | removed' },
      { status: 400 },
    );
  }
  // No filter defaults to the open queue (the moderation default view); a valid
  // filter narrows to that status. `listReports(null)` — all statuses — is not
  // reachable from this route by design.
  const status: SkillsHuntSubmissionReportStatus = parseStatus(rawStatus) ?? 'open';

  try {
    const items = await withDbTransaction((client) => listReports(client, status));
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_reports' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to load reports: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
