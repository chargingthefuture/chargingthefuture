import { NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import { insertPeerProgrammingAudit, runWeeklyAssignment } from 'lib/peer-programming/repository';
import { getActiveUserIdsLastDays } from 'lib/engagement/login-activity';
import { reportError } from 'lib/observability/report';

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
  } catch {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const useManualOverride = Boolean(body.allowManualOverride) && Array.isArray(body.activeUserIds);
  const activeUserIds = useManualOverride
    ? (body.activeUserIds ?? [])
    : await getActiveUserIdsLastDays(7);

  const membersSelected = Array.from(
    new Set(activeUserIds.filter((value) => value.trim().length > 0)),
  ).length;

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
