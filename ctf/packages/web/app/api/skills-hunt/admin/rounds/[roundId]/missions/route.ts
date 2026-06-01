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
import { reportError } from 'lib/observability/report';

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { roundId } = await params;

  try {
    const items = await withDbTransaction((client) => listMissionsForAdmin(client, roundId));
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'list_admin_missions', extra: { userId: gate.auth.userId, roundId } });
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('not an object');
    }
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  // Runtime narrowing: every field touched by createMission gets checked
  // before construction. Malformed types fail-fast with 400.
  const errors: string[] = [];
  if (typeof body.title !== 'string') errors.push('title must be a string');
  if (typeof body.goalTarget !== 'number') errors.push('goalTarget must be a number');
  const validGoalTypes = ['count_total_accepted', 'count_skills_in_sector', 'count_rare_skill_finds', 'count_distinct_sectors'] as const;
  if (typeof body.goalType !== 'string' || !validGoalTypes.includes(body.goalType as typeof validGoalTypes[number])) {
    errors.push('goalType must be one of ' + validGoalTypes.join(' | '));
  }
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    errors.push('description must be a string or null');
  }
  if (body.goalMetadata !== undefined && (typeof body.goalMetadata !== 'object' || body.goalMetadata === null || Array.isArray(body.goalMetadata))) {
    errors.push('goalMetadata must be an object');
  }
  if (body.bonusPoints !== undefined && typeof body.bonusPoints !== 'number') {
    errors.push('bonusPoints must be a number');
  }
  if (body.colorHex !== undefined && body.colorHex !== null && typeof body.colorHex !== 'string') {
    errors.push('colorHex must be a string or null');
  }
  const validStatuses = ['draft', 'active', 'locked', 'archived'] as const;
  if (body.status !== undefined && (typeof body.status !== 'string' || !validStatuses.includes(body.status as typeof validStatuses[number]))) {
    errors.push('status must be one of ' + validStatuses.join(' | '));
  }
  if (body.displayOrder !== undefined && typeof body.displayOrder !== 'number') {
    errors.push('displayOrder must be a number');
  }
  if (errors.length) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: errors.join('; ') },
      { status: 400 },
    );
  }

  const input: MissionCreateInput = {
    roundId,
    title: body.title as string,
    description: (body.description as string | null | undefined) ?? null,
    goalType: body.goalType as MissionCreateInput['goalType'],
    goalTarget: body.goalTarget as number,
    goalMetadata: (body.goalMetadata as Record<string, unknown> | undefined) ?? {},
    bonusPoints: (body.bonusPoints as number | undefined) ?? 0,
    colorHex: (body.colorHex as string | null | undefined) ?? null,
    status: (body.status as MissionCreateInput['status'] | undefined) ?? 'active',
    displayOrder: (body.displayOrder as number | undefined) ?? 0,
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
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'create_mission', extra: { userId: gate.auth.userId, roundId } });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to create mission.' },
      { status: 503 },
    );
  }
}
