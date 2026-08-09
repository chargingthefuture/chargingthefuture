import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { notifyRoundsEndingSoon } from 'lib/skills-hunt/notifications';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Round-ending-24h notification cron entry point.
// Idempotent: notifyRoundsEndingSoon checks per (user, round) for an existing
// row before inserting, so re-running the same day is safe.
// Wire a daily cron (or scheduled platform job) to POST to this endpoint.
export async function POST(request: Request) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const result = await withDbTransaction((client) => notifyRoundsEndingSoon(client));
    return NextResponse.json({ ok: true, emitted: result.emitted }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_notifications_round_ending_soon' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to run round-ending-soon notifications: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
