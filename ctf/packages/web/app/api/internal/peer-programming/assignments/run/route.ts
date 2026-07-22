import { NextResponse } from 'next/server';
import { insertPeerProgrammingAudit, runWeeklyAssignment } from 'lib/peer-programming/repository';
import { getActiveUserIdsLastDays } from 'lib/engagement/login-activity';
import { listUnlockedUserIds } from 'lib/unlock/repository';
import { reportError } from 'lib/observability/report';

// Cron-only: forms this week's PeerProgramming cohorts from the last-7-days active set, without an
// admin clicking "Run weekly assignment". Guarded by CRON_SECRET (Bearer), matching the Unlock
// reward-reconciliation convention. Safe to run more than once a week — runWeeklyAssignment upserts
// cohorts per (week, label) and the assignment notifications are idempotent per (user, week), so a
// repeat run cannot double-form a cohort or re-notify a member. The manual admin run is untouched.
const SCHEDULER_ACTOR_ID = 'peer-programming-scheduler';

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, code: 'peer_programming_scheduler_forbidden', message: 'Invalid cron secret.' },
      { status: 403 },
    );
  }

  // Only unlocked (approved_full) members may be placed into cohorts. The recent-login set includes
  // people who signed in but never completed Unlock (e.g. a v2 account returning to v3), so filter
  // them out before forming cohorts.
  const activeCandidates = await getActiveUserIdsLastDays(7);
  const unlocked = await listUnlockedUserIds(activeCandidates);
  const filteredActiveUserIds = activeCandidates.filter((value) => unlocked.has(value.trim()));
  // Deduplicate (and trim/drop blanks) before forming cohorts: getActiveUserIdsLastDays may return
  // duplicate ids, and cohort formation must receive the same unique set that membersSelected counts.
  const activeUserIds = [
    ...new Set(filteredActiveUserIds.map((value) => value.trim()).filter((value) => value.length > 0)),
  ];
  const membersSelected = activeUserIds.length;

  try {
    const result = await runWeeklyAssignment({ actorId: SCHEDULER_ACTOR_ID, activeUserIds });

    await insertPeerProgrammingAudit({
      actorId: SCHEDULER_ACTOR_ID,
      command: 'peer-programming.cohort.weekly.select',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'cohort_assignment',
      targetId: SCHEDULER_ACTOR_ID,
      metadata: { ...result, membersSelected, source: 'weekly_scheduler' },
    });

    return NextResponse.json({ ok: true, ...result, membersSelected }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'internal_assignments_run' });
    return NextResponse.json(
      { ok: false, code: 'peer_programming_scheduler_unavailable', message: 'Weekly cohort assignment unavailable.' },
      { status: 503 },
    );
  }
}
