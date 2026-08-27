// SkillsHunt — Missions module.
//
// Backs the Missions feature locked into Wave 2 scope by the post-design
// reconciliation (see ctf-skills-hunt-session-continuity.md sect 2.9).
// Owns:
//   - DB row mappers for skills_hunt_missions + skills_hunt_mission_progress
//   - List queries (admin and player-with-progress views)
//   - Progress recompute hook fired by review acceptance
//
// Does NOT own (deferred to follow-up commits):
//   - Admin CRUD endpoints (POST/PUT/DELETE /api/skills-hunt/admin/rounds/{id}/missions)
//   - Player-facing GET /api/skills-hunt/rounds/{id}/missions route handler
//   - In-DB notification fan-out on mission completion (writes to
//     skills_hunt_notifications; GetStream is out of scope per
//     continuity doc §2.11)
//   - Service-credit ledger entry on completion
//
// Recompute strategy: when reviewSubmission accepts a submission, the
// review hook calls recomputeMissionProgressForUser(client, roundId, userId).
// That recomputes counts for every mission scoped to roundId from the user's
// accepted submissions in that round. Cheaper than per-mutation deltas and
// resilient to edits/rejects that flip an earlier accept.

import type { PoolClient } from 'pg';
import type {
  SkillsHuntMission,
  SkillsHuntMissionGoalType,
  SkillsHuntMissionProgress,
  SkillsHuntMissionStatus,
  SkillsHuntMissionWithProgress,
} from './types';

type SkillsHuntMissionRow = {
  id: string;
  round_id: string;
  title: string;
  description: string | null;
  goal_type: SkillsHuntMissionGoalType;
  goal_target: number;
  goal_metadata: Record<string, unknown>;
  bonus_points: number;
  color_hex: string | null;
  status: SkillsHuntMissionStatus;
  display_order: number;
  auto_created: boolean;
  source_sector: string | null;
  source_gap_at_creation: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type SkillsHuntMissionProgressRow = {
  id: string;
  mission_id: string;
  user_id: string;
  progress_count: number;
  completed_at: Date | null;
  bonus_credited_at: Date | null;
  metadata: Record<string, unknown>;
  updated_at: Date;
};

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function mapMission(row: SkillsHuntMissionRow): SkillsHuntMission {
  return {
    id: row.id,
    roundId: row.round_id,
    title: row.title,
    description: row.description,
    goalType: row.goal_type,
    goalTarget: row.goal_target,
    goalMetadata: normalizeJsonObject(row.goal_metadata),
    bonusPoints: row.bonus_points,
    colorHex: row.color_hex,
    status: row.status,
    displayOrder: row.display_order,
    autoCreated: row.auto_created,
    sourceSector: row.source_sector,
    sourceGapAtCreation: row.source_gap_at_creation == null ? null : Number(row.source_gap_at_creation),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapMissionProgress(row: SkillsHuntMissionProgressRow): SkillsHuntMissionProgress {
  return {
    id: row.id,
    missionId: row.mission_id,
    userId: row.user_id,
    progressCount: row.progress_count,
    completedAtIso: row.completed_at ? toIso(row.completed_at) : null,
    bonusCreditedAtIso: row.bonus_credited_at ? toIso(row.bonus_credited_at) : null,
    metadata: normalizeJsonObject(row.metadata),
    updatedAtIso: toIso(row.updated_at),
  };
}

export async function listMissionsForRound(
  client: PoolClient,
  roundId: string,
): Promise<SkillsHuntMission[]> {
  const result = await client.query<SkillsHuntMissionRow>(
    `
      SELECT id, round_id, title, description, goal_type, goal_target,
             goal_metadata, bonus_points, color_hex, status, display_order,
             auto_created, source_sector, source_gap_at_creation::text AS source_gap_at_creation,
             created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM skills_hunt_missions
      WHERE round_id = $1::uuid
        AND status IN ('active', 'locked')
      ORDER BY display_order ASC, created_at ASC
    `,
    [roundId],
  );
  return result.rows.map(mapMission);
}

export async function listMissionsForRoundWithProgress(
  client: PoolClient,
  roundId: string,
  userId: string,
): Promise<SkillsHuntMissionWithProgress[]> {
  const missions = await listMissionsForRound(client, roundId);
  if (missions.length === 0) {
    return [];
  }
  const progressResult = await client.query<SkillsHuntMissionProgressRow>(
    `
      SELECT id, mission_id, user_id, progress_count, completed_at,
             bonus_credited_at, metadata, updated_at
      FROM skills_hunt_mission_progress
      WHERE user_id = $1
        AND mission_id = ANY($2::uuid[])
    `,
    [userId, missions.map((m) => m.id)],
  );
  const byMission = new Map<string, SkillsHuntMissionProgress>();
  for (const row of progressResult.rows) {
    byMission.set(row.mission_id, mapMissionProgress(row));
  }
  return missions.map((mission) => ({
    ...mission,
    progress: byMission.get(mission.id) ?? null,
  }));
}

// Recomputes progress_count for every mission in a round for a given user.
// Called from reviewSubmission when an accept-or-edit transition could
// change the user's accepted set. Pure recompute (idempotent) — safe to
// re-run on every accept without delta tracking.
//
// Returns the missions that crossed from incomplete to complete in this
// recompute, so the caller can fan out a "mission complete" notification
// + service-credit ledger entry. Wave 2 follow-up wires those side effects.
export async function recomputeMissionProgressForUser(
  client: PoolClient,
  roundId: string,
  userId: string,
): Promise<{ newlyCompleted: SkillsHuntMissionWithProgress[] }> {
  const missions = await listMissionsForRound(client, roundId);
  if (missions.length === 0) {
    return { newlyCompleted: [] };
  }

  // Pull the user's accepted submissions in this round once; each goal
  // type derives its count from this set.
  const submissionsResult = await client.query<{
    skills: unknown;
    claimed_professions: unknown;
    score_breakdown: Record<string, unknown>;
  }>(
    `
      SELECT skills, claimed_professions, score_breakdown
      FROM skills_hunt_submissions
      WHERE round_id = $1::uuid
        AND submitter_user_id = $2
        AND status = 'accepted'
        AND deleted_at IS NULL
    `,
    [roundId, userId],
  );

  const acceptedSubmissions = submissionsResult.rows.map(mapAcceptedSubmission);

  // Sector-goal matching: resolve each submission's skills to taxonomy sectors once, so
  // count_skills_in_sector counts real taxonomy membership instead of relying only on the
  // claimed-professions text proxy. One query for the whole accepted set.
  if (missions.some((mission) => mission.goalType === 'count_skills_in_sector')) {
    const sectorsBySkill = await mapSkillsToSectors(
      client,
      acceptedSubmissions.flatMap((submission) => submission.skills),
    );
    for (const submission of acceptedSubmissions) {
      submission.matchedSectors = collectSectorsForSkills(submission.skills, sectorsBySkill);
    }
  }

  const newlyCompleted: SkillsHuntMissionWithProgress[] = [];

  for (const mission of missions) {
    const entry = await processMissionProgress(client, mission, userId, acceptedSubmissions);
    if (entry) {
      newlyCompleted.push(entry);
    }
  }

  return { newlyCompleted };
}

type AcceptedSubmissionRow = {
  skills: unknown;
  claimed_professions: unknown;
  score_breakdown: Record<string, unknown>;
};

// Maps one accepted-submission DB row into the shape the goal-type counters
// consume. rareSkillBonus is read defensively from score_breakdown, which is
// free-form JSON that may not carry the field.
function mapAcceptedSubmission(row: AcceptedSubmissionRow): AcceptedSubmissionForMission {
  return {
    matchedSectors: new Set<string>(),
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    claimedProfessions: Array.isArray(row.claimed_professions)
      ? (row.claimed_professions as string[])
      : [],
    rareSkillBonus:
      typeof row.score_breakdown === 'object'
      && row.score_breakdown !== null
      && typeof (row.score_breakdown as { rareSkillBonus?: unknown }).rareSkillBonus === 'number'
        ? ((row.score_breakdown as { rareSkillBonus: number }).rareSkillBonus)
        : 0,
  };
}

// Recomputes and upserts progress for a single mission. Returns the
// mission-with-progress entry when this recompute crossed it from incomplete
// to complete, otherwise null.
async function processMissionProgress(
  client: PoolClient,
  mission: SkillsHuntMission,
  userId: string,
  acceptedSubmissions: AcceptedSubmissionForMission[],
): Promise<SkillsHuntMissionWithProgress | null> {
  const progressCount = computeProgressForMission(mission, acceptedSubmissions);
  const previousResult = await client.query<SkillsHuntMissionProgressRow>(
    `
      SELECT id, mission_id, user_id, progress_count, completed_at,
             bonus_credited_at, metadata, updated_at
      FROM skills_hunt_mission_progress
      WHERE mission_id = $1::uuid AND user_id = $2
      LIMIT 1
    `,
    [mission.id, userId],
  );
  const previous = previousResult.rows[0] ? mapMissionProgress(previousResult.rows[0]) : null;
  const wasCompleted = previous?.completedAtIso != null;
  const isNowCompleted = progressCount >= mission.goalTarget;
  const justCompleted = isNowCompleted && !wasCompleted;
  const completedAtClause = justCompleted ? 'NOW()' : 'completed_at';

  const upsertResult = await client.query<SkillsHuntMissionProgressRow>(
    `
      INSERT INTO skills_hunt_mission_progress
        (mission_id, user_id, progress_count, completed_at, updated_at)
      VALUES ($1::uuid, $2, $3, ${justCompleted ? 'NOW()' : 'NULL'}, NOW())
      ON CONFLICT (mission_id, user_id) DO UPDATE
        SET progress_count = EXCLUDED.progress_count,
            completed_at = ${completedAtClause === 'NOW()' ? 'NOW()' : 'skills_hunt_mission_progress.completed_at'},
            updated_at = NOW()
      RETURNING id, mission_id, user_id, progress_count, completed_at,
                bonus_credited_at, metadata, updated_at
    `,
    [mission.id, userId, progressCount],
  );
  const updated = mapMissionProgress(upsertResult.rows[0]);
  if (justCompleted) {
    return { ...mission, progress: updated };
  }
  return null;
}

type AcceptedSubmissionForMission = {
  skills: string[];
  claimedProfessions: string[];
  rareSkillBonus: number;
  // Lowercased taxonomy sector names this submission's skills belong to; filled by the
  // recompute when any sector-goal mission exists in the round.
  matchedSectors: Set<string>;
};

// Resolves a set of submission skill names to the lowercased taxonomy sector names they belong
// to (skill → job title → sector). Inactive taxonomy rows are excluded so an archived sector
// stops counting without touching stored progress.
async function mapSkillsToSectors(
  client: PoolClient,
  skills: string[],
): Promise<Map<string, Set<string>>> {
  const normalized = [...new Set(skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean))];
  const bySkill = new Map<string, Set<string>>();
  if (normalized.length === 0) {
    return bySkill;
  }
  const result = await client.query<{ skill_name: string; sector_name: string }>(
    `
      SELECT DISTINCT LOWER(s.name) AS skill_name, LOWER(sec.name) AS sector_name
      FROM skills_taxonomy_skills s
      JOIN skills_taxonomy_job_titles jt ON jt.id = s.job_title_id
      JOIN skills_taxonomy_sectors sec ON sec.id = jt.sector_id
      WHERE s.is_active = TRUE AND jt.is_active = TRUE AND sec.is_active = TRUE
        AND LOWER(s.name) = ANY($1::text[])
    `,
    [normalized],
  );
  for (const row of result.rows) {
    const sectors = bySkill.get(row.skill_name) ?? new Set<string>();
    sectors.add(row.sector_name);
    bySkill.set(row.skill_name, sectors);
  }
  return bySkill;
}

function collectSectorsForSkills(
  skills: string[],
  sectorsBySkill: Map<string, Set<string>>,
): Set<string> {
  const matched = new Set<string>();
  for (const skill of skills) {
    const sectors = sectorsBySkill.get(skill.trim().toLowerCase());
    if (sectors) {
      for (const sector of sectors) {
        matched.add(sector);
      }
    }
  }
  return matched;
}

function computeProgressForMission(
  mission: SkillsHuntMission,
  acceptedSubmissions: AcceptedSubmissionForMission[],
): number {
  switch (mission.goalType) {
    case 'count_total_accepted':
      return acceptedSubmissions.length;
    case 'count_rare_skill_finds':
      return acceptedSubmissions.filter((s) => s.rareSkillBonus > 0).length;
    case 'count_skills_in_sector': {
      const sectorName = typeof mission.goalMetadata.sectorName === 'string'
        ? (mission.goalMetadata.sectorName as string).toLowerCase()
        : null;
      if (!sectorName) {
        return 0;
      }
      // A submission counts when any of its skills belongs to the sector in the taxonomy, or —
      // kept for back-compat with progress earned before the taxonomy join — when a claimed
      // profession matches the sector name.
      return acceptedSubmissions.filter((s) =>
        s.matchedSectors.has(sectorName)
        || s.claimedProfessions.some((p) => p.toLowerCase() === sectorName),
      ).length;
    }
    default:
      return 0;
  }
}

// --- Admin CRUD helpers ----------------------------------------------------

export type MissionCreateInput = {
  roundId: string;
  title: string;
  description?: string | null;
  goalType: SkillsHuntMissionGoalType;
  goalTarget: number;
  goalMetadata?: Record<string, unknown>;
  bonusPoints?: number;
  colorHex?: string | null;
  status?: SkillsHuntMissionStatus;
  displayOrder?: number;
};

export type MissionUpdateInput = Partial<Omit<MissionCreateInput, 'roundId'>>;

const MISSION_RETURN_COLS = `
  id, round_id, title, description, goal_type, goal_target,
  goal_metadata, bonus_points, color_hex, status, display_order,
  auto_created, source_sector, source_gap_at_creation::text AS source_gap_at_creation,
  created_by_user_id, updated_by_user_id, created_at, updated_at
`;

export async function listMissionsForAdmin(
  client: PoolClient,
  roundId: string,
): Promise<SkillsHuntMission[]> {
  const result = await client.query<SkillsHuntMissionRow>(
    `SELECT ${MISSION_RETURN_COLS}
     FROM skills_hunt_missions
     WHERE round_id = $1::uuid
     ORDER BY display_order ASC, created_at ASC`,
    [roundId],
  );
  return result.rows.map(mapMission);
}

export async function getMissionById(
  client: PoolClient,
  missionId: string,
): Promise<SkillsHuntMission | null> {
  const result = await client.query<SkillsHuntMissionRow>(
    `SELECT ${MISSION_RETURN_COLS} FROM skills_hunt_missions WHERE id = $1::uuid LIMIT 1`,
    [missionId],
  );
  return result.rows[0] ? mapMission(result.rows[0]) : null;
}

export async function createMission(
  client: PoolClient,
  actorId: string,
  input: MissionCreateInput,
): Promise<SkillsHuntMission> {
  const result = await client.query<SkillsHuntMissionRow>(
    `
      INSERT INTO skills_hunt_missions
        (round_id, title, description, goal_type, goal_target, goal_metadata,
         bonus_points, color_hex, status, display_order,
         created_by_user_id, updated_by_user_id)
      VALUES
        ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $11)
      RETURNING ${MISSION_RETURN_COLS}
    `,
    [
      input.roundId,
      input.title.trim(),
      input.description?.trim() ?? null,
      input.goalType,
      input.goalTarget,
      JSON.stringify(input.goalMetadata ?? {}),
      input.bonusPoints ?? 0,
      input.colorHex ?? null,
      input.status ?? 'active',
      input.displayOrder ?? 0,
      actorId,
    ],
  );
  return mapMission(result.rows[0]);
}

export async function updateMission(
  client: PoolClient,
  actorId: string,
  missionId: string,
  input: MissionUpdateInput,
): Promise<SkillsHuntMission | null> {
  // Partial update. Non-nullable columns use COALESCE (a null param means "leave
  // unchanged"). The two nullable columns an admin can intentionally clear —
  // description and color_hex — use a "provided" boolean so passing an explicit
  // null actually writes null rather than being swallowed by COALESCE.
  const result = await client.query<SkillsHuntMissionRow>(
    `
      UPDATE skills_hunt_missions
      SET
        title          = COALESCE($2, title),
        description     = CASE WHEN $3::boolean THEN $4 ELSE description END,
        goal_type      = COALESCE($5, goal_type),
        goal_target    = COALESCE($6, goal_target),
        goal_metadata  = COALESCE($7::jsonb, goal_metadata),
        bonus_points   = COALESCE($8, bonus_points),
        color_hex       = CASE WHEN $9::boolean THEN $10 ELSE color_hex END,
        status         = COALESCE($11, status),
        display_order  = COALESCE($12, display_order),
        updated_by_user_id = $13,
        updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING ${MISSION_RETURN_COLS}
    `,
    buildMissionUpdateParams(missionId, input, actorId),
  );
  return result.rows[0] ? mapMission(result.rows[0]) : null;
}

// Resolves the description update param: undefined means "leave unchanged"
// (mapped to null, which the CASE guard skips); an explicit value or explicit
// null is written through after trimming.
function resolveDescriptionParam(input: MissionUpdateInput): string | null {
  if (input.description === undefined) return null;
  return input.description?.trim() ?? null;
}

// Builds the ordered param list for the updateMission UPDATE statement. Kept
// separate so the many per-field null/provided resolutions don't inflate the
// query function's complexity.
function buildMissionUpdateParams(
  missionId: string,
  input: MissionUpdateInput,
  actorId: string,
): unknown[] {
  return [
    missionId,
    input.title?.trim() ?? null,
    input.description !== undefined,
    resolveDescriptionParam(input),
    input.goalType ?? null,
    input.goalTarget ?? null,
    input.goalMetadata !== undefined ? JSON.stringify(input.goalMetadata) : null,
    input.bonusPoints ?? null,
    input.colorHex !== undefined,
    input.colorHex !== undefined ? input.colorHex : null,
    input.status ?? null,
    input.displayOrder ?? null,
    actorId,
  ];
}

// Soft-archive (status='archived'). Hard delete is intentionally not exposed —
// progress rows have ON DELETE CASCADE and we don't want admins to nuke
// scoring history with one wrong click.
export async function archiveMission(
  client: PoolClient,
  actorId: string,
  missionId: string,
): Promise<SkillsHuntMission | null> {
  return updateMission(client, actorId, missionId, { status: 'archived' });
}

function validateRoundId(input: MissionCreateInput): string | null {
  if (!input.roundId || typeof input.roundId !== 'string') return 'roundId required';
  return null;
}

function validateTitle(input: MissionCreateInput): string | null {
  if (!input.title || input.title.trim().length < 2 || input.title.length > 200) return 'title 2-200 chars required';
  return null;
}

function validateDescription(input: MissionCreateInput): string | null {
  if (input.description && input.description.length > 1000) return 'description max 1000 chars';
  return null;
}

function validateGoalType(input: MissionCreateInput): string | null {
  const validGoalTypes: SkillsHuntMissionGoalType[] = [
    'count_total_accepted', 'count_skills_in_sector', 'count_rare_skill_finds',
  ];
  if (!validGoalTypes.includes(input.goalType)) return 'invalid goalType';
  return null;
}

function validateGoalTarget(input: MissionCreateInput): string | null {
  if (!Number.isInteger(input.goalTarget) || input.goalTarget <= 0) return 'goalTarget must be positive integer';
  return null;
}

function validateSectorMetadata(input: MissionCreateInput): string | null {
  if (input.goalType === 'count_skills_in_sector') {
    const sector = input.goalMetadata?.sectorName;
    if (typeof sector !== 'string' || sector.trim().length === 0) return 'goalMetadata.sectorName required for count_skills_in_sector';
  }
  return null;
}

function validateBonusPoints(input: MissionCreateInput): string | null {
  if (input.bonusPoints != null && (!Number.isInteger(input.bonusPoints) || input.bonusPoints < 0)) {
    return 'bonusPoints must be non-negative integer';
  }
  return null;
}

export function validateMissionCreateInput(input: MissionCreateInput): string | null {
  // Field checks run in order; the first failure wins (behavior preserved from
  // the original inline sequence).
  const checks = [
    validateRoundId,
    validateTitle,
    validateDescription,
    validateGoalType,
    validateGoalTarget,
    validateSectorMetadata,
    validateBonusPoints,
  ];
  for (const check of checks) {
    const error = check(input);
    if (error) return error;
  }
  return null;
}
