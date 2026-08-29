// Cohort proposals from Workforce gaps (issue #904).
//
// Workforce is the single source of the talent-gap signal. On a cadence this module reads the
// per-occupation training gaps that Workforce computes live (`fetchOccupationGapReport`) and turns the
// largest of them into a ranked, sector-diverse **proposal queue** — it does NOT create cohorts
// outright. An admin reviews the queue and either approves a proposal (choosing a 1/3/5-month term,
// which opens a real cohort) or dismisses it. It never writes back into Workforce, Directory, or Skills
// Taxonomy; it only reads the gap list and writes SkillUp proposal/cohort rows.
//
// Owner decision (2026-07-23, small active user base): proposal queue, not auto-create; re-read gaps at
// most every `generation_interval_days` (default 90); no max-concurrent cap on proposals (the admin
// opens cohorts on demand); keep a per-sector cap so one big-gap sector does not crowd the queue; the
// admin picks the term at approval. Fully automatic creation and a demand-*prediction* algorithm are
// deferred (that is where `max_concurrent` becomes load-bearing again). All knobs live in
// `skill_up_auto_cohort_config` (admin-editable).
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { fetchOccupationGapReport } from 'lib/shared/workforce-interface';
import { createCohort, insertSkillUpAudit } from 'lib/skill-up/repository';
import {
  SKILL_UP_AUTO_COHORT_ACTOR_ID,
  SKILL_UP_AUTO_COHORT_DEFAULT_MILESTONES,
  SKILL_UP_AUTO_COHORT_DEFAULTS,
  type SkillUpProposalTermMonths,
} from 'lib/skill-up/constants';

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
  generationIntervalDays: number;
  lastGeneratedAt: string | null;
};

export type AutoCohortRunSummary = {
  ranAtIso: string;
  enabled: boolean;
  skipped?: 'disabled' | 'no_workforce_share' | 'cadence_not_due';
  generated: number;
  superseded: number;
  consideredOccupations: number;
  closed: Array<{ cohortId: string; occupation: string }>;
};

export type PendingProposal = {
  id: string;
  sourceJobTitleId: string;
  occupation: string;
  sector: string;
  skillLevel: string;
  gap: number;
  rank: number;
  generatedAtIso: string;
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
  generation_interval_days: number;
  last_generated_at: string | null;
};

export async function getAutoCohortConfig(): Promise<AutoCohortConfig> {
  const result = await queryDb<ConfigRow>(
    `SELECT enabled, min_gap_threshold::text, max_concurrent, per_sector_cap, skill_level_filter, top_n,
            default_term_days, default_seats, default_required_credits::text,
            default_trainer_split_percent::text, default_completion_bonus_credits::text,
            generation_interval_days, last_generated_at::text AS last_generated_at
     FROM skill_up_auto_cohort_config
     WHERE singleton_key = TRUE
     LIMIT 1`,
  );

  const row = result.rows[0];
  if (!row) {
    // No config row written yet — fall back to the coded launch defaults.
    return {
      enabled: SKILL_UP_AUTO_COHORT_DEFAULTS.enabled,
      minGapThreshold: SKILL_UP_AUTO_COHORT_DEFAULTS.minGapThreshold,
      maxConcurrent: SKILL_UP_AUTO_COHORT_DEFAULTS.maxConcurrent,
      perSectorCap: SKILL_UP_AUTO_COHORT_DEFAULTS.perSectorCap,
      skillLevelFilter: SKILL_UP_AUTO_COHORT_DEFAULTS.skillLevelFilter,
      topN: SKILL_UP_AUTO_COHORT_DEFAULTS.topN,
      defaultTermDays: SKILL_UP_AUTO_COHORT_DEFAULTS.defaultTermDays,
      defaultSeats: SKILL_UP_AUTO_COHORT_DEFAULTS.defaultSeats,
      defaultRequiredCredits: SKILL_UP_AUTO_COHORT_DEFAULTS.defaultRequiredCredits,
      defaultTrainerSplitPercent: SKILL_UP_AUTO_COHORT_DEFAULTS.defaultTrainerSplitPercent,
      defaultCompletionBonusCredits: SKILL_UP_AUTO_COHORT_DEFAULTS.defaultCompletionBonusCredits,
      generationIntervalDays: SKILL_UP_AUTO_COHORT_DEFAULTS.generationIntervalDays,
      lastGeneratedAt: null,
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
    generationIntervalDays: Number(row.generation_interval_days),
    lastGeneratedAt: row.last_generated_at,
  };
}

// Workforce demand depends on skills_taxonomy_sectors.workforce_share. If no sector carries a positive
// share, Workforce falls back to an even split and the "largest gap" ordering is meaningless — so we
// refuse to generate proposals off that degenerate signal (issue #904 dependency note).
async function hasPositiveWorkforceShare(): Promise<boolean> {
  const result = await queryDb<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM skills_taxonomy_sectors
     WHERE is_active = TRUE AND workforce_share IS NOT NULL AND workforce_share > 0`,
  );
  return Number(result.rows[0]?.total ?? '0') > 0;
}

async function getActiveAutoCohortJobTitleIds(): Promise<Set<string>> {
  const result = await queryDb<{ job_title_id: string | null }>(
    `SELECT source_job_title_id::text AS job_title_id
     FROM skill_up_cohorts
     WHERE auto_created = TRUE AND status IN ('open', 'active')`,
  );
  return new Set(result.rows.map((row) => row.job_title_id).filter((id): id is string => Boolean(id)));
}

async function getPendingProposalJobTitleIds(): Promise<Set<string>> {
  const result = await queryDb<{ job_title_id: string }>(
    `SELECT source_job_title_id::text AS job_title_id
     FROM skill_up_cohort_proposals
     WHERE status = 'pending'`,
  );
  return new Set(result.rows.map((row) => row.job_title_id));
}

// Fixed-term lifecycle: an auto cohort whose term has elapsed is closed. A plain status flip is safe
// here — auto cohorts are created with no required deposit, so there is no escrow to settle.
async function closeExpiredAutoCohorts(): Promise<Array<{ cohortId: string; occupation: string }>> {
  const result = await queryDb<{ id: string; track: string }>(
    `UPDATE skill_up_cohorts
     SET status = 'completed', updated_at = NOW()
     WHERE auto_created = TRUE AND status IN ('open', 'active') AND end_date < CURRENT_DATE
     RETURNING id::text AS id, track`,
  );
  return result.rows.map((row) => ({ cohortId: row.id, occupation: row.track }));
}

function todayIso(): string {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  return base.toISOString().slice(0, 10);
}

function addMonthsIso(startIso: string, months: number): string {
  const [year, month, day] = startIso.split('-').map((part) => Number(part));
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { code?: string }).code === '23505';
}

type Candidate = { jobTitleId: string; occupation: string; sector: string; skillLevel: string; gap: number };

// Group candidates by sector, preserving input order within each sector. Because `candidates` is
// sorted largest-gap-first, Map insertion order also orders sectors by their top gap.
function groupCandidatesBySector(candidates: Candidate[]): Map<string, Candidate[]> {
  const bySector = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const list = bySector.get(candidate.sector);
    if (list) {
      list.push(candidate);
    } else {
      bySector.set(candidate.sector, [candidate]);
    }
  }
  return bySector;
}

/**
 * Sector-diverse ranking (owner decision 2026-07-23): pick round-robin across sectors so the top of the
 * queue spans sectors rather than being dominated by one big-gap sector. Input `candidates` is already
 * sorted largest-gap-first, so the first time we meet a sector it is at its largest gap — Map insertion
 * order therefore orders sectors by their top gap. Each sector contributes at most `perSectorCap`; the
 * whole queue is bounded by `topN` for reviewability.
 */
function sectorDiverseOrder(candidates: Candidate[], perSectorCap: number, topN: number): Candidate[] {
  const bySector = groupCandidatesBySector(candidates);

  const sectors = [...bySector.keys()];
  const takenPerSector = new Map<string, number>();
  const ranked: Candidate[] = [];
  const cap = Math.max(1, perSectorCap);
  const limit = Math.max(0, topN);

  let progressed = true;
  while (progressed && ranked.length < limit) {
    progressed = false;
    for (const sector of sectors) {
      if (ranked.length >= limit) {
        break;
      }
      const taken = takenPerSector.get(sector) ?? 0;
      if (taken >= cap) {
        continue;
      }
      const list = bySector.get(sector);
      if (!list || taken >= list.length) {
        continue;
      }
      ranked.push(list[taken]);
      takenPerSector.set(sector, taken + 1);
      progressed = true;
    }
  }

  return ranked;
}

/**
 * Read the Workforce gaps and refresh the pending proposal queue. Ranked, sector-diverse, deduped
 * against occupations already covered by an open/active auto cohort. Existing pending proposals that
 * are no longer valid (occupation now covered, or gap fell below the threshold) are superseded. Does
 * NOT create cohorts.
 */
export async function generateCohortProposals(input: {
  config: AutoCohortConfig;
  source: string;
}): Promise<{ generated: number; superseded: number; considered: number; skipped?: 'no_workforce_share' }> {
  if (!(await hasPositiveWorkforceShare())) {
    return { generated: 0, superseded: 0, considered: 0, skipped: 'no_workforce_share' };
  }

  const [gaps, coveredJobTitleIds] = await Promise.all([fetchOccupationGapReport(), getActiveAutoCohortJobTitleIds()]);

  const candidates: Candidate[] = gaps
    .filter((item) => item.skillLevel === input.config.skillLevelFilter)
    .filter((item) => item.gap >= input.config.minGapThreshold)
    .filter((item) => !coveredJobTitleIds.has(item.jobTitleId))
    .map((item) => ({
      jobTitleId: item.jobTitleId,
      occupation: item.occupation,
      sector: item.sector || 'Unassigned',
      skillLevel: item.skillLevel,
      gap: item.gap,
    }));

  const ranked = sectorDiverseOrder(candidates, input.config.perSectorCap, input.config.topN);
  const freshIds = ranked.map((candidate) => candidate.jobTitleId);

  const pendingBefore = await getPendingProposalJobTitleIds();

  const outcome = await withDbTransaction(async (client) => {
    // Supersede pending proposals no longer in the fresh set (occupation covered or gap below threshold).
    const superseded = await client.query(
      `UPDATE skill_up_cohort_proposals
       SET status = 'superseded', updated_at = NOW()
       WHERE status = 'pending' AND NOT (source_job_title_id = ANY($1::uuid[]))`,
      [freshIds],
    );

    for (let index = 0; index < ranked.length; index += 1) {
      const candidate = ranked[index];
      const rank = index + 1;
      if (pendingBefore.has(candidate.jobTitleId)) {
        await client.query(
          `UPDATE skill_up_cohort_proposals
           SET occupation = $2, sector = $3, skill_level = $4, gap_at_proposal = $5, rank = $6,
               generated_source = $7, generated_at = NOW(), updated_at = NOW()
           WHERE source_job_title_id = $1::uuid AND status = 'pending'`,
          [candidate.jobTitleId, candidate.occupation, candidate.sector, candidate.skillLevel, candidate.gap, rank, input.source],
        );
      } else {
        await client.query(
          `INSERT INTO skill_up_cohort_proposals
             (source_job_title_id, occupation, sector, skill_level, gap_at_proposal, rank, status, generated_source)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, 'pending', $7)`,
          [candidate.jobTitleId, candidate.occupation, candidate.sector, candidate.skillLevel, candidate.gap, rank, input.source],
        );
      }
    }

    // Stamp the cadence timestamp (upsert so a missing singleton row does not stall the 90-day cadence).
    await client.query(
      `INSERT INTO skill_up_auto_cohort_config (singleton_key, last_generated_at)
       VALUES (TRUE, NOW())
       ON CONFLICT (singleton_key) DO UPDATE SET last_generated_at = NOW(), updated_at = NOW()`,
    );

    return { superseded: superseded.rowCount ?? 0 };
  });

  return { generated: ranked.length, superseded: outcome.superseded, considered: candidates.length };
}

async function auditRun(reason: string, metadata: Record<string, unknown>): Promise<void> {
  await insertSkillUpAudit({
    actorId: SKILL_UP_AUTO_COHORT_ACTOR_ID,
    command: 'skill-up.cohort.auto_create',
    policyStatus: 'allow',
    reason,
    targetType: 'auto_cohort_run',
    targetId: SKILL_UP_AUTO_COHORT_ACTOR_ID,
    metadata,
  });
}

/**
 * The entry the cron and the admin "Refresh proposals" button call. Always closes expired auto cohorts;
 * regenerates the proposal queue only when forced (admin refresh) or the 90-day cadence is due (cron).
 */
export async function runAutoCohortProposals(
  input: { source: string; force?: boolean } = { source: 'manual' },
): Promise<AutoCohortRunSummary> {
  const ranAtIso = new Date().toISOString();
  const config = await getAutoCohortConfig();
  const closed = await closeExpiredAutoCohorts();

  if (!config.enabled) {
    await auditRun('disabled', { source: input.source, skipped: 'disabled', closed: closed.length });
    return { ranAtIso, enabled: false, skipped: 'disabled', generated: 0, superseded: 0, consideredOccupations: 0, closed };
  }

  const due =
    Boolean(input.force) ||
    config.lastGeneratedAt == null ||
    daysBetween(config.lastGeneratedAt, ranAtIso) >= config.generationIntervalDays;

  if (!due) {
    await auditRun('cadence_not_due', { source: input.source, skipped: 'cadence_not_due', closed: closed.length });
    return { ranAtIso, enabled: true, skipped: 'cadence_not_due', generated: 0, superseded: 0, consideredOccupations: 0, closed };
  }

  const generation = await generateCohortProposals({ config, source: input.source });

  await auditRun(generation.skipped ?? 'ok', {
    source: input.source,
    skipped: generation.skipped,
    generated: generation.generated,
    superseded: generation.superseded,
    considered: generation.considered,
    closed: closed.length,
  });

  return {
    ranAtIso,
    enabled: true,
    skipped: generation.skipped,
    generated: generation.generated,
    superseded: generation.superseded,
    consideredOccupations: generation.considered,
    closed,
  };
}

export async function listPendingProposals(limit = 100): Promise<PendingProposal[]> {
  const result = await queryDb<{
    id: string;
    source_job_title_id: string;
    occupation: string;
    sector: string;
    skill_level: string;
    gap_at_proposal: string;
    rank: number;
    generated_at: string;
  }>(
    `SELECT id::text, source_job_title_id::text, occupation, sector, skill_level,
            gap_at_proposal::text, rank, generated_at
     FROM skill_up_cohort_proposals
     WHERE status = 'pending'
     ORDER BY rank ASC, gap_at_proposal DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    sourceJobTitleId: row.source_job_title_id,
    occupation: row.occupation,
    sector: row.sector,
    skillLevel: row.skill_level,
    gap: Number(row.gap_at_proposal),
    rank: row.rank,
    generatedAtIso: new Date(row.generated_at).toISOString(),
  }));
}

export type ApproveProposalResult =
  | { status: 'approved'; proposalId: string; cohortId: string; occupation: string; endDate: string }
  | { status: 'already_covered'; proposalId: string; occupation: string };

/**
 * Admin approves a pending proposal: opens a real cohort with the chosen 1/3/5-month term. The proposal
 * is claimed atomically (guarded on `status='pending'`) before the cohort is created, so it cannot be
 * double-approved. If the occupation already has an open auto cohort (the unique-cohort guard fires),
 * the proposal is marked superseded and no cohort is opened.
 */
export async function approveCohortProposal(input: {
  actorId: string;
  proposalId: string;
  termMonths: SkillUpProposalTermMonths;
}): Promise<ApproveProposalResult> {
  const config = await getAutoCohortConfig();

  const claim = await queryDb<{
    source_job_title_id: string;
    occupation: string;
    sector: string;
    gap_at_proposal: string;
  }>(
    `UPDATE skill_up_cohort_proposals
     SET status = 'approved', decided_by_user_id = $2, decided_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid AND status = 'pending'
     RETURNING source_job_title_id::text, occupation, sector, gap_at_proposal::text`,
    [input.proposalId, input.actorId],
  );

  const proposal = claim.rows[0];
  if (!proposal) {
    throw new Error('invalid_state');
  }

  const startDate = todayIso();
  const endDate = addMonthsIso(startDate, input.termMonths);

  try {
    const created = await createCohort({
      actorId: SKILL_UP_AUTO_COHORT_ACTOR_ID,
      idempotencyKey: `proposal-approve:${input.proposalId}`,
      // The cohort title is the occupation on its own. It used to be prefixed with the plugin name
      // ("SkillUp: Journalists / Reporters", and "LevelUp: …" before the rename), which repeated the
      // name of the plugin the member is already inside on every card — wasted width on a phone
      // (owner report, 2026-08-29).
      title: proposal.occupation,
      description: `Training cohort for ${proposal.occupation} (${proposal.sector}). Approved from the Workforce talent-gap proposal queue.`,
      track: proposal.occupation,
      seats: config.defaultSeats,
      startDate,
      endDate,
      // One global economic policy (per-occupation tuning deferred, #1197). A deposit is only required
      // when defaultRequiredCredits > 0.
      requiredCredits: config.defaultRequiredCredits,
      allowNoDeposit: config.defaultRequiredCredits <= 0,
      trainerSplitPercent: config.defaultTrainerSplitPercent,
      completionBonusCredits: config.defaultCompletionBonusCredits,
      milestones: SKILL_UP_AUTO_COHORT_DEFAULT_MILESTONES.map((milestone) => ({ ...milestone })),
      status: 'open',
      autoCreated: true,
      sourceJobTitleId: proposal.source_job_title_id,
      sourceSector: proposal.sector,
      sourceGapAtCreation: Number(proposal.gap_at_proposal),
    });

    await queryDb(
      `UPDATE skill_up_cohort_proposals SET created_cohort_id = $2::uuid, updated_at = NOW() WHERE id = $1::uuid`,
      [input.proposalId, created.cohortId],
    );

    await insertSkillUpAudit({
      actorId: input.actorId,
      command: 'skill-up.cohort.proposal_approve',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'cohort',
      targetId: created.cohortId,
      metadata: {
        proposalId: input.proposalId,
        occupation: proposal.occupation,
        sector: proposal.sector,
        termMonths: input.termMonths,
        endDate,
        targetContext: { cohortId: created.cohortId },
      },
    });

    return { status: 'approved', proposalId: input.proposalId, cohortId: created.cohortId, occupation: proposal.occupation, endDate };
  } catch (error) {
    if (isUniqueViolation(error)) {
      // The occupation already has an open auto cohort — do not open a second. Mark the proposal
      // superseded rather than leaving it stuck in 'approved' with no cohort.
      await queryDb(
        `UPDATE skill_up_cohort_proposals
         SET status = 'superseded', created_cohort_id = NULL, updated_at = NOW()
         WHERE id = $1::uuid`,
        [input.proposalId],
      );
      return { status: 'already_covered', proposalId: input.proposalId, occupation: proposal.occupation };
    }

    // Unexpected failure — return the proposal to the queue so it can be retried.
    await queryDb(
      `UPDATE skill_up_cohort_proposals
       SET status = 'pending', decided_by_user_id = NULL, decided_at = NULL, updated_at = NOW()
       WHERE id = $1::uuid`,
      [input.proposalId],
    );
    throw error;
  }
}

export async function dismissCohortProposal(input: {
  actorId: string;
  proposalId: string;
}): Promise<{ status: 'dismissed'; proposalId: string; occupation: string }> {
  const result = await queryDb<{ occupation: string }>(
    `UPDATE skill_up_cohort_proposals
     SET status = 'dismissed', decided_by_user_id = $2, decided_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid AND status = 'pending'
     RETURNING occupation`,
    [input.proposalId, input.actorId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('invalid_state');
  }

  await insertSkillUpAudit({
    actorId: input.actorId,
    command: 'skill-up.cohort.proposal_dismiss',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'cohort_proposal',
    targetId: input.proposalId,
    metadata: { proposalId: input.proposalId, occupation: row.occupation, targetContext: { proposalId: input.proposalId } },
  });

  return { status: 'dismissed', proposalId: input.proposalId, occupation: row.occupation };
}
