import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import { archiveMission, getMissionById, updateMission, type MissionUpdateInput } from 'lib/skills-hunt/missions';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string; missionId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { missionId } = await params;

  try {
    const mission = await withDbTransaction((client) => getMissionById(client, missionId));
    if (!mission) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Mission not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ mission }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load mission.' },
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

  const { missionId } = await params;

  let body: MissionUpdateInput;
  try {
    body = (await request.json()) as MissionUpdateInput;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  try {
    const mission = await withDbTransaction((client) => updateMission(client, gate.auth.userId, missionId, body));
    if (!mission) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Mission not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, mission }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to update mission.' },
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

  const { missionId } = await params;

  try {
    const mission = await withDbTransaction((client) => archiveMission(client, gate.auth.userId, missionId));
    if (!mission) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.submissionNotFound, message: 'Mission not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, mission }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to archive mission.' },
      { status: 503 },
    );
  }
}
