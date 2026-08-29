// Auto-opened missions from Workforce sector gaps (owner decision 2026-08-27).
//
// Workforce computes, live, how many people each sector is short of (demand from the population
// model minus supply from Directory). This module sums those per-occupation gaps by sector and
// opens a capped number of 'count_skills_in_sector' missions per active round for the sectors
// with the largest shortfall — so SkillsHunt scouting effort points at what the community is
// actually missing. Admin-authored missions are untouched; generated missions are ordinary rows
// in skills_hunt_missions marked auto_created, and an admin can archive one like any other.
//
// Unlike SkillUp's cohort proposal queue there is no approval step: a mission commits no credits
// (bonus defaults to 0), no seats and no schedule, so the guardrails are a config kill switch
// (skills_hunt_auto_mission_config.enabled), a per-round cap, and one-click archive. Runs are
// idempotent: at most one non-archived auto mission per (round, sector), enforced by the partial
// unique index uq_skills_hunt_auto_mission_active and a pre-read of existing sectors.
//
// Entry points: createRound calls generateAutoMissionsForRound inline so a new round starts with
// its gap missions; the weekly GitHub Actions workflow (skills-hunt-auto-missions.yml) and the
// admin "Run now" button call runAutoMissions to top up rounds that were already active when the
// gaps or the config changed. Every run also rewrites the goal target and bonus points on the auto
// missions already live from the saved config, so a settings change reaches the missions already
// open instead of only the next ones (see refreshLiveAutoMissions). It never writes into Workforce,
// Directory, or Skills Taxonomy.

import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { fetchOccupationGapReport } from 'lib/shared/workforce-interface';
import { logSkillsHuntAudit } from './audit';
import {
  SKILLS_HUNT_AUTO_MISSION_ACTOR_ID,
  SKILLS_HUNT_AUTO_MISSION_DEFAULTS,
} from './constants';

export type AutoMissionConfig = {
  enabled: boolean;
  minGapThreshold: number;
  maxPerRound: number;
  defaultGoalTarget: number;
  defaultBonusPoints: number;
  updatedAtIso: string | null;
};

type AutoMissionRoundResult = {
  roundId: string;
  roundName: string;
  opened: Array<{ sector: string; gap: number; missionId: string }>;
  // Live auto missions in this round whose goal target / bonus points were brought back in line
  // with the saved config by this run (see refreshLiveAutoMissions).
  updated: number;
};

type AutoMissionRunSummary = {
  ranAtIso: string;
  enabled: boolean;
  skipped?: 'disabled' | 'no_workforce_share' | 'no_active_rounds';
  consideredSectors: number;
  rounds: AutoMissionRoundResult[];
};

type ConfigRow = {
  enabled: boolean;
  min_gap_threshold: string;
  max_per_round: number;
  default_goal_target: number;
  default_bonus_points: number;
  updated_at: string | null;
};

export async function getAutoMissionConfig(): Promise<AutoMissionConfig> {
  const result = await queryDb<ConfigRow>(
    `SELECT enabled, min_gap_threshold::text, max_per_round, default_goal_target,
            default_bonus_points, updated_at::text AS updated_at
     FROM skills_hunt_auto_mission_config
     WHERE singleton_key = TRUE
     LIMIT 1`,
  );

  const row = result.rows[0];
  if (!row) {
    // No config row written yet — fall back to the coded launch defaults.
    return {
      enabled: SKILLS_HUNT_AUTO_MISSION_DEFAULTS.enabled,
      minGapThreshold: SKILLS_HUNT_AUTO_MISSION_DEFAULTS.minGapThreshold,
      maxPerRound: SKILLS_HUNT_AUTO_MISSION_DEFAULTS.maxPerRound,
      defaultGoalTarget: SKILLS_HUNT_AUTO_MISSION_DEFAULTS.defaultGoalTarget,
      defaultBonusPoints: SKILLS_HUNT_AUTO_MISSION_DEFAULTS.defaultBonusPoints,
      updatedAtIso: null,
    };
  }

  return {
    enabled: row.enabled,
    minGapThreshold: Number(row.min_gap_threshold),
    maxPerRound: Number(row.max_per_round),
    defaultGoalTarget: Number(row.default_goal_target),
    defaultBonusPoints: Number(row.default_bonus_points),
    updatedAtIso: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export type AutoMissionConfigUpdate = {
  enabled: boolean;
  minGapThreshold: number;
  maxPerRound: number;
  defaultGoalTarget: number;
  defaultBonusPoints: number;
};

export async function updateAutoMissionConfig(
  actorId: string,
  input: AutoMissionConfigUpdate,
): Promise<AutoMissionConfig> {
  await queryDb(
    `INSERT INTO skills_hunt_auto_mission_config
       (singleton_key, enabled, min_gap_threshold, max_per_round, default_goal_target,
        default_bonus_points, updated_by_user_id, updated_at)
     VALUES (TRUE, $1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (singleton_key) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       min_gap_threshold = EXCLUDED.min_gap_threshold,
       max_per_round = EXCLUDED.max_per_round,
       default_goal_target = EXCLUDED.default_goal_target,
       default_bonus_points = EXCLUDED.default_bonus_points,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = NOW()`,
    [input.enabled, input.minGapThreshold, input.maxPerRound, input.defaultGoalTarget, input.defaultBonusPoints, actorId],
  );
  return getAutoMissionConfig();
}

// Workforce demand depends on skills_taxonomy_sectors.workforce_share. If no sector carries a
// positive share, Workforce falls back to an even split and "largest gap" is meaningless — so we
// refuse to open missions off that degenerate signal (same guard as SkillUp's auto cohorts).
async function hasPositiveWorkforceShare(): Promise<boolean> {
  const result = await queryDb<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM skills_taxonomy_sectors
     WHERE is_active = TRUE AND workforce_share IS NOT NULL AND workforce_share > 0`,
  );
  return Number(result.rows[0]?.total ?? '0') > 0;
}

type SectorGap = { sector: string; gap: number };

// Sum the per-occupation gaps into one shortfall figure per sector, largest first. Occupations
// with no real sector ('Unassigned' fallback) are dropped — a mission cannot point at them.
async function computeSectorGaps(): Promise<SectorGap[]> {
  const gaps = await fetchOccupationGapReport();
  const bySector = new Map<string, number>();
  for (const item of gaps) {
    const sector = (item.sector || '').trim();
    if (!sector || sector === 'Unassigned') {
      continue;
    }
    bySector.set(sector, (bySector.get(sector) ?? 0) + item.gap);
  }
  return [...bySector.entries()]
    .map(([sector, gap]) => ({ sector, gap }))
    .sort((a, b) => b.gap - a.gap);
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { code?: string }).code === '23505';
}

async function listExistingAutoMissionSectors(client: PoolClient, roundId: string): Promise<Set<string>> {
  const result = await client.query<{ source_sector: string | null }>(
    `SELECT source_sector
     FROM skills_hunt_missions
     WHERE round_id = $1::uuid AND auto_created = TRUE AND status <> 'archived'`,
    [roundId],
  );
  return new Set(
    result.rows.map((row) => row.source_sector).filter((sector): sector is string => Boolean(sector)),
  );
}

// The config knobs are the source of truth for auto missions, not just their starting values: an
// admin who raises the bonus or the goal target expects the missions already open to follow. Each
// run therefore rewrites goal_target / bonus_points on this round's live auto missions from the
// saved config (a no-op when they already match, so the row is not touched needlessly).
//
// Two deliberate limits. A per-mission edit an admin makes to an auto mission's target or bonus is
// reverted by the next run — auto missions are config-driven by definition; edit a manual mission,
// or change the config, to make a change stick. And the gap figure (source_gap_at_creation, quoted
// in the description) is a snapshot from when the mission opened and is left alone.
async function refreshLiveAutoMissions(
  client: PoolClient,
  roundId: string,
  config: AutoMissionConfig,
): Promise<number> {
  const result = await client.query(
    `UPDATE skills_hunt_missions
     SET goal_target = $2, bonus_points = $3, updated_by_user_id = $4, updated_at = NOW()
     WHERE round_id = $1::uuid
       AND auto_created = TRUE
       AND status <> 'archived'
       AND (goal_target <> $2 OR bonus_points <> $3)`,
    [roundId, config.defaultGoalTarget, config.defaultBonusPoints, SKILLS_HUNT_AUTO_MISSION_ACTOR_ID],
  );
  return result.rowCount ?? 0;
}

async function insertAutoMission(
  client: PoolClient,
  roundId: string,
  candidate: SectorGap,
  config: AutoMissionConfig,
): Promise<string | null> {
  const gapRounded = Math.round(candidate.gap);
  try {
    const result = await client.query<{ id: string }>(
      `INSERT INTO skills_hunt_missions
         (round_id, title, description, goal_type, goal_target, goal_metadata, bonus_points,
          status, display_order, auto_created, source_sector, source_gap_at_creation,
          created_by_user_id, updated_by_user_id)
       VALUES ($1::uuid, $2, $3, 'count_skills_in_sector', $4, $5::jsonb, $6,
               'active', 0, TRUE, $7, $8, $9, $9)
       RETURNING id`,
      [
        roundId,
        `Scout the ${candidate.sector} sector`,
        `Workforce shows the community is short about ${gapRounded.toLocaleString('en-US')} people in ${candidate.sector}. `
          + `Nominate people with ${candidate.sector} skills — each accepted nomination that includes a ${candidate.sector} skill counts toward this mission.`,
        config.defaultGoalTarget,
        JSON.stringify({ sectorName: candidate.sector }),
        config.defaultBonusPoints,
        candidate.sector,
        candidate.gap,
        SKILLS_HUNT_AUTO_MISSION_ACTOR_ID,
      ],
    );
    return result.rows[0]?.id ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      // A concurrent run opened this sector's mission first — the idempotency guard did its job.
      return null;
    }
    throw error;
  }
}

/**
 * Bring one round's auto missions in line with the saved config: first rewrite the goal target and
 * bonus points on the missions already live in it, then open missions for the largest-gap sectors
 * it does not cover yet (respecting the per-round cap). `sectorGaps` is the precomputed
 * largest-first list from computeSectorGaps(), already filtered to real sectors.
 *
 * The refresh runs before the cap check on purpose: a round already at its cap opens nothing, and
 * skipping it there would leave exactly those rounds stuck on the settings they were created with.
 */
async function generateAutoMissionsForRound(
  client: PoolClient,
  roundId: string,
  input: { config: AutoMissionConfig; sectorGaps: SectorGap[] },
): Promise<{ opened: Array<{ sector: string; gap: number; missionId: string }>; updated: number }> {
  const updated = await refreshLiveAutoMissions(client, roundId, input.config);

  const existingSectors = await listExistingAutoMissionSectors(client, roundId);
  const openSlots = Math.max(0, input.config.maxPerRound - existingSectors.size);
  if (openSlots === 0) {
    return { opened: [], updated };
  }

  const candidates = input.sectorGaps
    .filter((item) => item.gap >= input.config.minGapThreshold)
    .filter((item) => !existingSectors.has(item.sector))
    .slice(0, openSlots);

  const opened: Array<{ sector: string; gap: number; missionId: string }> = [];
  for (const candidate of candidates) {
    const missionId = await insertAutoMission(client, roundId, candidate, input.config);
    if (missionId) {
      opened.push({ sector: candidate.sector, gap: candidate.gap, missionId });
    }
  }
  return { opened, updated };
}

/**
 * Round-create hook. createRound calls this in its own follow-up transaction after the round has
 * committed, and reports (rather than rethrows) a failure — a broken gap signal must not undo
 * round creation. Skips cleanly when disabled or when the Workforce signal is degenerate.
 */
export async function generateAutoMissionsForNewRound(
  client: PoolClient,
  roundId: string,
): Promise<{ opened: number }> {
  const config = await getAutoMissionConfig();
  if (!config.enabled || !(await hasPositiveWorkforceShare())) {
    return { opened: 0 };
  }
  const sectorGaps = await computeSectorGaps();
  const result = await generateAutoMissionsForRound(client, roundId, { config, sectorGaps });
  return { opened: result.opened.length };
}

function auditRun(reason: string, metadata: Record<string, unknown>): void {
  logSkillsHuntAudit({
    actorId: SKILLS_HUNT_AUTO_MISSION_ACTOR_ID,
    command: 'skills-hunt.mission.auto_generate',
    status: 'allow',
    reason,
    targetType: 'auto_mission_run',
    targetId: SKILLS_HUNT_AUTO_MISSION_ACTOR_ID,
    result: 'success',
    errorCategory: null,
    metadata,
  });
}

/**
 * The entry the weekly cron and the admin "Run now" button call: top up every currently active
 * round (status 'active' and not past its end) with gap missions. Idempotent — a round already
 * carrying its capped set of live auto missions gets nothing new.
 */
export async function runAutoMissions(input: { source: string }): Promise<AutoMissionRunSummary> {
  const ranAtIso = new Date().toISOString();
  const config = await getAutoMissionConfig();

  if (!config.enabled) {
    auditRun('disabled', { source: input.source, skipped: 'disabled' });
    return { ranAtIso, enabled: false, skipped: 'disabled', consideredSectors: 0, rounds: [] };
  }

  if (!(await hasPositiveWorkforceShare())) {
    auditRun('no_workforce_share', { source: input.source, skipped: 'no_workforce_share' });
    return { ranAtIso, enabled: true, skipped: 'no_workforce_share', consideredSectors: 0, rounds: [] };
  }

  const activeRounds = await queryDb<{ id: string; name: string }>(
    `SELECT id::text AS id, name
     FROM skills_hunt_rounds
     WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())
     ORDER BY starts_at DESC`,
  );

  if (activeRounds.rows.length === 0) {
    auditRun('no_active_rounds', { source: input.source, skipped: 'no_active_rounds' });
    return { ranAtIso, enabled: true, skipped: 'no_active_rounds', consideredSectors: 0, rounds: [] };
  }

  const sectorGaps = await computeSectorGaps();
  const rounds: AutoMissionRoundResult[] = [];
  for (const round of activeRounds.rows) {
    const result = await withDbTransaction((client) =>
      generateAutoMissionsForRound(client, round.id, { config, sectorGaps }),
    );
    rounds.push({ roundId: round.id, roundName: round.name, opened: result.opened, updated: result.updated });
  }

  auditRun('ok', {
    source: input.source,
    consideredSectors: sectorGaps.length,
    rounds: rounds.map((round) => ({ roundId: round.roundId, opened: round.opened.length, updated: round.updated })),
  });

  return { ranAtIso, enabled: true, consideredSectors: sectorGaps.length, rounds };
}
