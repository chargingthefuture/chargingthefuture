import { NextResponse } from 'next/server';
import {
  auditBestEffort,
  contributionsErrorResponse,
  ensureMutationCsrf,
  parseJsonObject,
  requireContributionsAdminAccess,
} from '../../_lib';
import { createCycle, listCycles } from 'lib/contributions/repository';

type CycleBody = {
  startsAt?: string;
  endsAt?: string;
  fiatGoalUsd?: number;
  quoraCommentGoal?: number;
  githubStarGoal?: number;
};

export async function GET(request: Request) {
  const gate = await requireContributionsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const limitCandidate = Number(url.searchParams.get('limit') ?? 50);

  try {
    const cycles = await listCycles(Number.isFinite(limitCandidate) ? limitCandidate : 50);
    return NextResponse.json({ ok: true, cycles });
  } catch (error) {
    return contributionsErrorResponse(error, 'Fundraiser cycles unavailable.', 'admin_cycles_list');
  }
}

export async function POST(request: Request) {
  const gate = await requireContributionsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const parsed = await parseJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed.body as CycleBody;

  if (typeof body.startsAt !== 'string' || typeof body.endsAt !== 'string') {
    return NextResponse.json(
      { ok: false, code: 'contributions_invalid_payload', message: 'startsAt and endsAt are required.' },
      { status: 400 },
    );
  }

  try {
    const cycle = await createCycle({
      actorUserId: gate.auth.userId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      fiatGoalUsd: body.fiatGoalUsd ?? 0,
      quoraCommentGoal: body.quoraCommentGoal ?? 0,
      githubStarGoal: body.githubStarGoal ?? 0,
    });

    await auditBestEffort('admin_cycle_create', {
      actorUserId: gate.auth.userId,
      action: 'contributions.admin.cycle.create',
      metadata: { cycleId: cycle.id, startsAt: cycle.startsAt, endsAt: cycle.endsAt },
    });

    return NextResponse.json({ ok: true, cycle }, { status: 201 });
  } catch (error) {
    return contributionsErrorResponse(error, 'Fundraiser cycle creation unavailable.', 'admin_cycle_create');
  }
}
