import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import { insertPeerProgrammingAudit, runWeeklyAssignment } from 'lib/peer-programming/repository';
import { getActiveUserIdsLastDays } from 'lib/engagement/login-activity';
import { listUnlockedUserIds } from 'lib/unlock/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type AssignmentBody = {
  activeUserIds?: string[];
  allowManualOverride?: boolean;
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: AssignmentBody;
  try {
    body = (await request.json()) as AssignmentBody;
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: `Invalid JSON body: ${failureReason(error)}` }, { status: 400 });
  }

  const useManualOverride = Boolean(body.allowManualOverride) && Array.isArray(body.activeUserIds);
  const resolvedUserIds = useManualOverride
    ? (body.activeUserIds ?? [])
    : await getActiveUserIdsLastDays(7);

  // Only unlocked (approved_full) members may be placed into cohorts. Filter the recent-login set so
  // a not-yet-unlocked person (e.g. a v2 account returning to v3) is never assigned. A manual admin
  // override is an explicit choice, so it is passed through as-is.
  let activeUserIds = resolvedUserIds;
  if (!useManualOverride) {
    const unlocked = await listUnlockedUserIds(resolvedUserIds);
    activeUserIds = resolvedUserIds.filter((value) => unlocked.has(value.trim()));
  }

  const membersSelected = new Set(
    activeUserIds.map((value) => value.trim()).filter((value) => value.length > 0),
  ).size;

  try {
    const result = await runWeeklyAssignment({ actorId: gate.auth.userId, activeUserIds });

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.cohort.weekly.select',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'cohort_assignment',
      targetId: gate.auth.userId,
      metadata: { ...result, membersSelected, source: useManualOverride ? 'manual_override' : 'server_login_activity' },
    });

    return NextResponse.json({ ok: true, ...result, membersSelected }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin_assignments_run' });
    return peerProgrammingErrorResponse(error, 'Weekly cohort assignment unavailable.');
  }
}
