import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSkillsHuntAdminAccess } from '../../../_lib';
import {
  getAutoMissionConfig,
  updateAutoMissionConfig,
  type AutoMissionConfigUpdate,
} from 'lib/skills-hunt/auto-missions';
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin knobs for the auto-opened gap missions: kill switch, minimum sector gap, per-round cap,
// and the goal target / bonus points every generated mission starts with.

type ConfigBodyResult =
  | { ok: true; input: AutoMissionConfigUpdate }
  | { ok: false; message: string };

// Runtime narrowing helpers, split so each stays inside the complexity limit (rule 116).
function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function validateConfigFields(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof body.enabled !== 'boolean') errors.push('enabled must be a boolean');
  if (typeof body.minGapThreshold !== 'number' || !Number.isFinite(body.minGapThreshold) || body.minGapThreshold < 0) {
    errors.push('minGapThreshold must be a non-negative number');
  }
  if (!isIntegerInRange(body.maxPerRound, 0, 20)) errors.push('maxPerRound must be an integer between 0 and 20');
  if (!isIntegerInRange(body.defaultGoalTarget, 1, Number.MAX_SAFE_INTEGER)) errors.push('defaultGoalTarget must be a positive integer');
  if (!isIntegerInRange(body.defaultBonusPoints, 0, Number.MAX_SAFE_INTEGER)) errors.push('defaultBonusPoints must be a non-negative integer');
  return errors;
}

function parseConfigBody(body: Record<string, unknown>): ConfigBodyResult {
  const errors = validateConfigFields(body);
  if (errors.length) {
    return { ok: false, message: errors.join('; ') };
  }
  return {
    ok: true,
    input: {
      enabled: body.enabled as boolean,
      minGapThreshold: body.minGapThreshold as number,
      maxPerRound: body.maxPerRound as number,
      defaultGoalTarget: body.defaultGoalTarget as number,
      defaultBonusPoints: body.defaultBonusPoints as number,
    },
  };
}

export async function GET() {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const config = await getAutoMissionConfig();
    return NextResponse.json({ config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_auto_missions_config' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to load auto-mission config: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

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

  const parsed = parseConfigBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.invalidPayload, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const config = await updateAutoMissionConfig(gate.auth.userId, parsed.input);
    logSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.mission.auto_config_update',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'auto_mission_config',
      targetId: 'singleton',
      result: 'success',
      errorCategory: null,
      metadata: { ...parsed.input },
    });
    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_auto_missions_config' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to save auto-mission config: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
