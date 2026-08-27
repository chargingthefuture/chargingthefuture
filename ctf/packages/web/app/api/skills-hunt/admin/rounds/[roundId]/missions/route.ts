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
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const VALID_GOAL_TYPES = ['count_total_accepted', 'count_skills_in_sector', 'count_rare_skill_finds'] as const;
const VALID_MISSION_STATUSES = ['active', 'locked', 'archived'] as const;

type MissionBodyResult =
  | { ok: true; input: MissionCreateInput }
  | { ok: false; message: string };

// Runtime narrowing: every field touched by createMission gets checked before
// construction. Malformed types fail-fast with 400. Checks are grouped across a
// few helpers to keep each within complexity limits; each pushes to `errors`.
function validateMissionCoreFields(body: Record<string, unknown>, errors: string[]): void {
  if (typeof body.title !== 'string') errors.push('title must be a string');
  if (typeof body.goalTarget !== 'number') errors.push('goalTarget must be a number');
  if (typeof body.goalType !== 'string' || !VALID_GOAL_TYPES.includes(body.goalType as typeof VALID_GOAL_TYPES[number])) {
    errors.push('goalType must be one of ' + VALID_GOAL_TYPES.join(' | '));
  }
  if (body.goalMetadata !== undefined && (typeof body.goalMetadata !== 'object' || body.goalMetadata === null || Array.isArray(body.goalMetadata))) {
    errors.push('goalMetadata must be an object');
  }
}

function validateMissionScoreFields(body: Record<string, unknown>, errors: string[]): void {
  if (body.bonusPoints !== undefined && typeof body.bonusPoints !== 'number') {
    errors.push('bonusPoints must be a number');
  }
  if (body.displayOrder !== undefined && typeof body.displayOrder !== 'number') {
    errors.push('displayOrder must be a number');
  }
  if (body.status !== undefined && (typeof body.status !== 'string' || !VALID_MISSION_STATUSES.includes(body.status as typeof VALID_MISSION_STATUSES[number]))) {
    errors.push('status must be one of ' + VALID_MISSION_STATUSES.join(' | '));
  }
}

function validateMissionCopyFields(body: Record<string, unknown>, errors: string[]): void {
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    errors.push('description must be a string or null');
  }
  if (body.colorHex !== undefined && body.colorHex !== null && typeof body.colorHex !== 'string') {
    errors.push('colorHex must be a string or null');
  }
}

function parseMissionBody(roundId: string, body: Record<string, unknown>): MissionBodyResult {
  const errors: string[] = [];
  validateMissionCoreFields(body, errors);
  validateMissionScoreFields(body, errors);
  validateMissionCopyFields(body, errors);
  if (errors.length) {
    return { ok: false, message: errors.join('; ') };
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
  return { ok: true, input };
}

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
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_missions' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to load missions: ${failureReason(error)}` },
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const parsed = parseMissionBody(roundId, body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: parsed.message },
      { status: 400 },
    );
  }
  const input = parsed.input;

  const validation = validateMissionCreateInput(input);
  if (validation) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: validation },
      { status: 400 },
    );
  }

  try {
    const mission = await withDbTransaction((client) => createMission(client, gate.auth.userId, input));
    logSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.mission.create',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'mission',
      targetId: mission.id,
      result: 'success',
      errorCategory: null,
      metadata: { roundId, goalType: mission.goalType },
    });
    return NextResponse.json({ ok: true, mission }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_missions' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to create mission: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
