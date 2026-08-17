import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { archiveMission, getMissionById, updateMission, type MissionUpdateInput } from 'lib/skills-hunt/missions';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// All operations on a mission must scope by both roundId AND missionId so
// callers from one round cannot read/write missions belonging to another
// round even with a leaked UUID. We fetch first, verify the round match,
// then act — keeps the lib helpers narrow.
async function loadMissionScopedToRound(missionId: string, roundId: string) {
  return withDbTransaction(async (client) => {
    const mission = await getMissionById(client, missionId);
    if (!mission || mission.roundId !== roundId) return null;
    return mission;
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string; missionId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { roundId, missionId } = await params;

  try {
    const mission = await loadMissionScopedToRound(missionId, roundId);
    if (!mission) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Mission not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ mission }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_missions_missionid' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to load mission: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ roundId: string; missionId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { roundId, missionId } = await params;

  let body: MissionUpdateInput;
  try {
    body = (await request.json()) as MissionUpdateInput;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  try {
    const scoped = await loadMissionScopedToRound(missionId, roundId);
    if (!scoped) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Mission not found.' },
        { status: 404 },
      );
    }
    const mission = await withDbTransaction((client) => updateMission(client, gate.auth.userId, missionId, body));
    if (!mission) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Mission not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, mission }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_missions_missionid' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to update mission: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

// DELETE soft-archives. Hard delete is intentionally not exposed.
export async function DELETE(request: Request, { params }: { params: Promise<{ roundId: string; missionId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { roundId, missionId } = await params;

  try {
    const scoped = await loadMissionScopedToRound(missionId, roundId);
    if (!scoped) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Mission not found.' },
        { status: 404 },
      );
    }
    const mission = await withDbTransaction((client) => archiveMission(client, gate.auth.userId, missionId));
    if (!mission) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Mission not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, mission }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_missions_missionid' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to archive mission: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
