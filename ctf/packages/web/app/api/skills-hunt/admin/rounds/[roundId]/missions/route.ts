import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../../_lib';
import { withDbTransaction } from 'lib/db/postgres';
import {
  createMission,
  listMissionsForAdmin,
  validateMissionCreateInput,
  type MissionCreateInput,
} from 'lib/skills-hunt/missions';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { roundId } = await params;

  try {
    const items = await withDbTransaction((client) => listMissionsForAdmin(client, roundId));
    return NextResponse.json({ items }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to load missions.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { roundId } = await params;

  let body: Partial<MissionCreateInput>;
  try {
    body = (await request.json()) as Partial<MissionCreateInput>;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input: MissionCreateInput = {
    roundId,
    title: typeof body.title === 'string' ? body.title : '',
    description: body.description ?? null,
    goalType: body.goalType ?? 'count_total_accepted',
    goalTarget: typeof body.goalTarget === 'number' ? body.goalTarget : 0,
    goalMetadata: body.goalMetadata ?? {},
    bonusPoints: typeof body.bonusPoints === 'number' ? body.bonusPoints : 0,
    colorHex: body.colorHex ?? null,
    status: body.status ?? 'active',
    displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : 0,
  };

  const validation = validateMissionCreateInput(input);
  if (validation) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: validation },
      { status: 400 },
    );
  }

  try {
    const mission = await withDbTransaction((client) => createMission(client, gate.auth.userId, input));
    return NextResponse.json({ ok: true, mission }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to create mission.' },
      { status: 503 },
    );
  }
}
