// Auto-cohort creation (issue #904).
//
// Workforce is the single source of the talent-gap signal. This module reads the per-occupation
// training gaps that Workforce computes live (`fetchOccupationGapReport`), and stands up LevelUp
// cohorts for the largest gaps — without an admin hand-building each cohort. It never writes back into
// Workforce, Directory, or Skills Taxonomy; it only reads the gap list and creates LevelUp rows.
//
// Lean launch policy (small active user base): take the top N Foundational-level gaps above a minimum
// gap, cap the number of concurrent auto cohorts and the number per sector, and give each cohort a
// fixed term. All knobs live in `level_up_auto_cohort_config` (admin-editable); per-occupation term
// overrides live in `level_up_auto_cohort_term_overrides`. The gap×talent-spread algorithm that will
// later set cadence and caps from the spread of people who already hold a skill is deferred.
import { queryDb } from 'lib/db/postgres';
import { fetchOccupationGapReport } from 'lib/workforce/repository';
import type { WorkforceOccupationGapItem } from 'lib/workforce/types';
import { createCohort, insertLevelUpAudit } from 'lib/level-up/repository';
import {
  LEVEL_UP_AUTO_COHORT_ACTOR_ID,
  LEVEL_UP_AUTO_COHORT_DEFAULT_MILESTONES,
  LEVEL_UP_AUTO_COHORT_DEFAULTS,
} from 'lib/level-up/constants';

export type AutoCohortConfig = {
  enabled: boolean;
  minGapThreshold: number;
  maxConcurrent: number;
  perSectorCap: number;
  skillLevelFilter: string;
  topN: number;
  defaultTermDays: number;
  defaultSeats: number;
  defaultRequiredCredits: number;
  defaultTrainerSplitPercent: number;
  defaultCompletionBonusCredits: number;
};

export type AutoCohortRunSummary = {
  ranAtIso: string;
  enabled: boolean;
  skipped?: 'disabled' | 'no_workforce_share';
  created: Array<{ cohortId: string; jobTitleId: string; occupation: string; sector: string; gap: number; endDate: string }>;
  closed: Array<{ cohortId: string; occupation: string }>;
  consideredOccupations: number;
  alreadyCovered: number;
  capacityRemaining: number;
};

type ConfigRow = {
  enabled: boolean;
  min_gap_threshold: string;
  max_concurrent: number;
  per_sector_cap: number;
  skill_level_filter: string;
  top_n: number;
  default_term_days: number;
  default_seats: number;
  default_required_credits: string;
  default_trainer_split_percent: string;
  default_completion_bonus_credits: string;
};

export async function getAutoCohortConfig(): Promise<AutoCohortConfig> {
  const result = await queryDb<ConfigRow>(
    `SELECT enabled, min_gap_threshold::text, max_concurrent, per_sector_cap, skill_level_filter, top_n,
            default_term_days, default_seats, default_required_credits::text,
            default_trainer_split_percent::text, default_completion_bonus_credits::text
     FROM level_up_auto_cohort_config
     WHERE singleton_key = TRUE
     LIMIT 1`,
  );

  const row = result.rows[0];
  if (!row) {
    // No config row written yet — fall back to the coded launch defaults.
    return {
      enabled: LEVEL_UP_AUTO_COHORT_DEFAULTS.enabled,
      minGapThreshold: LEVEL_UP_AUTO_COHORT_DEFAULTS.minGapThreshold,
      maxConcurrent: LEVEL_UP_AUTO_COHORT_DEFAULTS.maxConcurrent,
      perSectorCap: LEVEL_UP_AUTO_COHORT_DEFAULTS.perSectorCap,
      skillLevelFilter: LEVEL_UP_AUTO_COHORT_DEFAULTS.skillLevelFilter,
      topN: LEVEL_UP_AUTO_COHORT_DEFAULTS.topN,
      defaultTermDays: LEVEL_UP_AUTO_COHORT_DEFAULTS.defaultTermDays,
      defaultSeats: LEVEL_UP_AUTO_COHORT_DEFAULTS.defaultSeats,
      defaultRequiredCredits: LEVEL_UP_AUTO_COHORT_DEFAULTS.defaultRequiredCredits,
      defaultTrainerSplitPercent: LEVEL_UP_AUTO_COHORT_DEFAULTS.defaultTrainerSplitPercent,
      defaultCompletionBonusCredits: LEVEL_UP_AUTO_COHORT_DEFAULTS.defaultCompletionBonusCredits,
    };
  }

  return {
    enabled: row.enabled,
    minGapThreshold: Number(row.min_gap_threshold),
    maxConcurrent: Number(row.max_concurrent),
    perSectorCap: Number(row.per_sector_cap),
    skillLevelFilter: row.skill_level_filter,
    topN: Number(row.top_n),
    defaultTermDays: Number(row.default_term_days),
    defaultSeats: Number(row.default_seats),
    defaultRequiredCredits: Number(row.default_required_credits),
    defaultTrainerSplitPercent: Number(row.default_trainer_split_percent),
    defaultCompletionBonusCredits: Number(row.default_completion_bonus_credits),
  };
}

async function getTermOverrideDays(): Promise<Map<string, number>> {
  const result = await queryDb<{ job_title_id: string; term_days: number }>(
    `SELECT job_title_id::text AS job_title_id, term_days FROM level_up_auto_cohort_term_overrides`,
  );
  const map = new Map<string, number>();
  for (const row of result.rows) {
    map.set(row.job_title_id, Number(row.term_days));
  }
  return map;
}

// Workforce demand depends on skills_taxonomy_sectors.workforce_share. If no sector carries a positive
// share, Workforce falls back to an even split and the "largest gap" ordering is meaningless — so we
// refuse to auto-create off that degenerate signal (issue #904 dependency note).
async function hasPositiveWorkforceShare(): Promise<boolean> {
  const result = await queryDb<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM skills_taxonomy_sectors
     WHERE is_active = TRUE AND workforce_share IS NOT NULL AND workforce_share > 0`,
  );
  return Number(result.rows[0]?.total ?? '0') > 0;
}

type ActiveAutoCohort = { job_title_id: string | null; sector: string | null };

async function getActiveAutoCohorts(): Promise<ActiveAutoCohort[]> {
  const result = await queryDb<ActiveAutoCohort>(
    `SELECT source_job_title_id::text AS job_title_id, source_sector AS sector
     FROM level_up_cohorts
     WHERE auto_created = TRUE AND status IN ('open', 'active')`,
  );
  return result.rows;
}

// Fixed-term lifecycle: an auto cohort whose term has elapsed is closed. A plain status flip is safe
// here — auto cohorts are created with no required deposit, so there is no escrow to settle.
async function closeExpiredAutoCohorts(): Promise<Array<{ cohortId: string; occupation: string }>> {
  const result = await queryDb<{ id: string; track: string }>(
    `UPDATE level_up_cohorts
     SET status = 'completed', updated_at = NOW()
     WHERE auto_created = TRUE AND status IN ('open', 'active') AND end_date < CURRENT_DATE
     RETURNING id::text AS id, track`,
  );
  return result.rows.map((row) => ({ cohortId: row.id, occupation: row.track }));
}

function addDaysIso(days: number): string {
  // Deterministic date math without Date.now timing concerns at the day grain.
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function todayIso(): string {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  return base.toISOString().slice(0, 10);
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { code?: string }).code === '23505';
}

/**
 * Read the Workforce occupation gaps and stand up LevelUp cohorts for the largest of them, idempotently.
 * Safe to run repeatedly: the partial unique index and the already-covered check mean a re-run never
 * duplicates a cohort for an occupation. Also closes any auto cohort whose fixed term has elapsed.
 */
export async function runAutoCohortCreation(input: { source: string } = { source: 'manual' }): Promise<AutoCohortRunSummary> {
  const ranAtIso = new Date().toISOString();
  const config = await getAutoCohortConfig();

  const closed = await closeExpiredAutoCohorts();

  if (!config.enabled) {
    await insertLevelUpAudit({
      actorId: LEVEL_UP_AUTO_COHORT_ACTOR_ID,
      command: 'level-up.cohort.auto_create',
      policyStatus: 'allow',
      reason: 'disabled',
      targetType: 'auto_cohort_run',
      targetId: LEVEL_UP_AUTO_COHORT_ACTOR_ID,
      metadata: { source: input.source, skipped: 'disabled', closed: closed.length },
    });
    return { ranAtIso, enabled: false, skipped: 'disabled', created: [], closed, consideredOccupations: 0, alreadyCovered: 0, capacityRemaining: 0 };
  }

  if (!(await hasPositiveWorkforceShare())) {
    await insertLevelUpAudit({
      actorId: LEVEL_UP_AUTO_COHORT_ACTOR_ID,
      command: 'level-up.cohort.auto_create',
      policyStatus: 'allow',
      reason: 'no_workforce_share',
      targetType: 'auto_cohort_run',
      targetId: LEVEL_UP_AUTO_COHORT_ACTOR_ID,
      metadata: { source: input.source, skipped: 'no_workforce_share', closed: closed.length },
    });
    return { ranAtIso, enabled: true, skipped: 'no_workforce_share', created: [], closed, consideredOccupations: 0, alreadyCovered: 0, capacityRemaining: 0 };
  }

  const [gaps, active, termOverrides] = await Promise.all([
    fetchOccupationGapReport(),
    getActiveAutoCohorts(),
    getTermOverrideDays(),
  ]);

  const coveredJobTitleIds = new Set(active.map((row) => row.job_title_id).filter((id): id is string => Boolean(id)));
  const perSectorCount = new Map<string, number>();
  for (const row of active) {
    const sector = row.sector ?? 'Unassigned';
    perSectorCount.set(sector, (perSectorCount.get(sector) ?? 0) + 1);
  }

  let capacityRemaining = Math.max(0, config.maxConcurrent - active.length);

  // Candidates: the configured skill level, gap at or above the threshold, largest gap first
  // (the report is already sorted that way), capped at top N, and not already covered.
  const candidates: WorkforceOccupationGapItem[] = gaps
    .filter((item) => item.skillLevel === config.skillLevelFilter)
    .filter((item) => item.gap >= config.minGapThreshold)
    .slice(0, config.topN)
    .filter((item) => !coveredJobTitleIds.has(item.jobTitleId));

  const start = todayIso();
  const created: AutoCohortRunSummary['created'] = [];

  for (const item of candidates) {
    if (capacityRemaining <= 0) {
      break;
    }
    const sector = item.sector || 'Unassigned';
    if ((perSectorCount.get(sector) ?? 0) >= config.perSectorCap) {
      continue;
    }

    const termDays = termOverrides.get(item.jobTitleId) ?? config.defaultTermDays;
    const endDate = addDaysIso(termDays);

    try {
      const result = await createCohort({
        actorId: LEVEL_UP_AUTO_COHORT_ACTOR_ID,
        // Deterministic key so a same-run retry maps to the same cohort row.
        idempotencyKey: `auto-cohort:${item.jobTitleId}:${start}`,
        title: `LevelUp: ${item.occupation}`,
        description: `Auto-created training cohort for ${item.occupation} (${sector}). Stood up from the Workforce talent gap for this occupation.`,
        track: item.occupation,
        seats: config.defaultSeats,
        startDate: start,
        endDate,
        // Economic policy: one global, admin-editable default applied to every auto cohort (per-occupation
        // tuning deferred — issue #1197). A deposit is only required when defaultRequiredCredits > 0.
        requiredCredits: config.defaultRequiredCredits,
        allowNoDeposit: config.defaultRequiredCredits <= 0,
        trainerSplitPercent: config.defaultTrainerSplitPercent,
        completionBonusCredits: config.defaultCompletionBonusCredits,
        // Milestones drive the escrow split, the trainer payout, and the completion bonus on release.
        milestones: LEVEL_UP_AUTO_COHORT_DEFAULT_MILESTONES.map((m) => ({ ...m })),
        status: 'open',
        autoCreated: true,
        sourceJobTitleId: item.jobTitleId,
        sourceSector: sector,
        sourceGapAtCreation: item.gap,
      });

      created.push({ cohortId: result.cohortId, jobTitleId: item.jobTitleId, occupation: item.occupation, sector, gap: item.gap, endDate });
      coveredJobTitleIds.add(item.jobTitleId);
      perSectorCount.set(sector, (perSectorCount.get(sector) ?? 0) + 1);
      capacityRemaining -= 1;

      await insertLevelUpAudit({
        actorId: LEVEL_UP_AUTO_COHORT_ACTOR_ID,
        command: 'level-up.cohort.auto_create',
        policyStatus: 'allow',
        reason: 'ok',
        targetType: 'cohort',
        targetId: result.cohortId,
        metadata: { source: input.source, jobTitleId: item.jobTitleId, occupation: item.occupation, sector, gap: item.gap, termDays },
      });
    } catch (error) {
      // A concurrent run may have created the same occupation's cohort between our read and write.
      // The partial unique index rejects the duplicate — treat it as already covered, not a failure.
      if (isUniqueViolation(error)) {
        coveredJobTitleIds.add(item.jobTitleId);
        continue;
      }
      throw error;
    }
  }

  await insertLevelUpAudit({
    actorId: LEVEL_UP_AUTO_COHORT_ACTOR_ID,
    command: 'level-up.cohort.auto_create',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'auto_cohort_run',
    targetId: LEVEL_UP_AUTO_COHORT_ACTOR_ID,
    metadata: { source: input.source, created: created.length, closed: closed.length, consideredOccupations: candidates.length },
  });

  return {
    ranAtIso,
    enabled: true,
    created,
    closed,
    consideredOccupations: candidates.length,
    alreadyCovered: coveredJobTitleIds.size,
    capacityRemaining,
  };
}

/**
 * A trainer (or admin) claims an auto-created cohort that still has no human trainer. The cohort's
 * creator is the trainer of record in this plugin (`isTrainerForCohort` checks created_by_user_id),
 * so claiming replaces the scheduler id with the trainer's id.
 */
export async function claimAutoCohortTrainer(input: { cohortId: string; trainerUserId: string }): Promise<'claimed' | 'not_found' | 'already_claimed'> {
  const current = await queryDb<{ created_by_user_id: string; auto_created: boolean; status: string }>(
    `SELECT created_by_user_id, auto_created, status FROM level_up_cohorts WHERE id = $1::uuid LIMIT 1`,
    [input.cohortId],
  );
  const row = current.rows[0];
  if (!row || !row.auto_created) {
    return 'not_found';
  }
  if (row.created_by_user_id !== LEVEL_UP_AUTO_COHORT_ACTOR_ID) {
    return 'already_claimed';
  }

  await queryDb(
    `UPDATE level_up_cohorts
     SET created_by_user_id = $2, updated_at = NOW()
     WHERE id = $1::uuid AND created_by_user_id = $3`,
    [input.cohortId, input.trainerUserId, LEVEL_UP_AUTO_COHORT_ACTOR_ID],
  );

  // Backfill the trainer of record onto any enrollments that were created while the cohort still had
  // no trainer (members can enroll in an open auto cohort before it is claimed). Without this their
  // milestone-release payouts would have no trainer to pay. Only fill rows not already assigned.
  await queryDb(
    `UPDATE level_up_enrollments
     SET assigned_trainer_id = $2, updated_at = NOW()
     WHERE cohort_id = $1::uuid AND assigned_trainer_id IS NULL`,
    [input.cohortId, input.trainerUserId],
  );

  await insertLevelUpAudit({
    actorId: input.trainerUserId,
    command: 'level-up.cohort.claim_trainer',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'cohort',
    targetId: input.cohortId,
    // Structured target context per the cohort.claim_trainer audit contract, which requires
    // cohortId in targetContext. (workspaceId is a contract placeholder with no value in this
    // single-tenant codebase, so it is omitted, consistent with the admin.adjust_credits audit.)
    metadata: { claimedFrom: LEVEL_UP_AUTO_COHORT_ACTOR_ID, targetContext: { cohortId: input.cohortId } },
  });

  return 'claimed';
}
