import { NextResponse } from 'next/server';
import {
  contributionsErrorResponse,
  ensureMutationCsrf,
  isUuid,
  requireContributionsAdminAccess,
} from '../../../_lib';
import { insertContributionsAudit, updateCycle } from 'lib/contributions/repository';

type RouteParams = {
  params: Promise<{
    cycleId: string;
  }>;
};

type CyclePatchBody = {
  startsAt?: string;
  endsAt?: string;
  fiatGoalUsd?: number;
  quoraCommentGoal?: number;
  githubStarGoal?: number;
};

export async function PUT(request: Request, { params }: RouteParams) {
  const gate = await requireContributionsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { cycleId } = await params;
  if (!isUuid(cycleId)) {
    return NextResponse.json({ ok: false, code: 'contributions_invalid_payload', message: 'cycleId must be a UUID.' }, { status: 400 });
  }

  let body: CyclePatchBody;
  try {
    body = (await request.json()) as CyclePatchBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'contributions_invalid_payload', message: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    const cycle = await updateCycle({
      actorUserId: gate.auth.userId,
      cycleId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      fiatGoalUsd: body.fiatGoalUsd,
      quoraCommentGoal: body.quoraCommentGoal,
      githubStarGoal: body.githubStarGoal,
    });

    if (!cycle) {
      return NextResponse.json({ ok: false, code: 'contributions_not_found', message: 'Fundraiser cycle not found.' }, { status: 404 });
    }

    await insertContributionsAudit({
      actorUserId: gate.auth.userId,
      action: 'contributions.admin.cycle.update',
      metadata: { cycleId: cycle.id, startsAt: cycle.startsAt, endsAt: cycle.endsAt },
    });

    return NextResponse.json({ ok: true, cycle });
  } catch (error) {
    return contributionsErrorResponse(error, 'Fundraiser cycle update unavailable.', 'admin_cycle_update');
  }
}
