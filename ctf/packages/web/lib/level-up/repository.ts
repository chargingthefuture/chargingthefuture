import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  applyDisputeAdjustment,
  createEscrowHold,
  getOrCreateWallet,
  mintGrant,
  refundEscrow,
  releaseEscrow,
} from 'lib/shared/credits-interface';
import { createTransfer } from 'lib/shared/service-credits/createTransfer';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { LEVEL_UP_AUTO_COHORT_ACTOR_ID, LEVEL_UP_DEFAULT_TRAINER_SPLIT_PERCENT, LEVEL_UP_PLUGIN_SLUG } from 'lib/level-up/constants';

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

// Nullish-coalescing as a helper so a call site adds no branch to its enclosing function's
// complexity (identical semantics to `value ?? fallback`).
function orDefault<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}

function calculateTrainerPayout(learnerReleaseAmount: number, trainerSplitPercent: number): number {
  if (trainerSplitPercent <= 0) {
    return 0;
  }
  if (trainerSplitPercent >= 100) {
    throw new Error('invalid_payload');
  }
  // Business rule: trainer split is computed from total milestone allotment,
  // where learner release represents (100 - split)% of the milestone amount.
  return roundCurrency((learnerReleaseAmount * trainerSplitPercent) / (100 - trainerSplitPercent));
}

function ensurePositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_payload');
  }
}

async function readCommandIdempotency<T>(client: PoolClient, actorId: string, commandName: string, idempotencyKey: string) {
  const result = await client.query<{ response_payload: T }>(
    `SELECT response_payload
     FROM level_up_command_idempotency
     WHERE actor_id = $1 AND command_name = $2 AND idempotency_key = $3
     LIMIT 1`,
    [actorId, commandName, idempotencyKey],
  );

  return result.rows[0]?.response_payload ?? null;
}

async function writeCommandIdempotency(
  client: PoolClient,
  actorId: string,
  commandName: string,
  idempotencyKey: string,
  responsePayload: Record<string, unknown>,
) {
  await client.query(
    `INSERT INTO level_up_command_idempotency (id, actor_id, command_name, idempotency_key, response_payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (actor_id, command_name, idempotency_key)
     DO UPDATE SET response_payload = EXCLUDED.response_payload, updated_at = NOW()`,
    [randomUUID(), actorId, commandName, idempotencyKey, JSON.stringify(responsePayload)],
  );
}

export async function insertLevelUpAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  await queryDb(
    `INSERT INTO level_up_audit_events (id, actor_id, command, policy_status, reason, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [randomUUID(), input.actorId, input.command, input.policyStatus, input.reason, input.targetType, input.targetId, JSON.stringify(input.metadata ?? {})],
  );
}

async function evaluateRateLimit(client: PoolClient, input: {
  userId: string;
  commandName: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; count: number }> {
  const now = new Date();
  const windowStartedAt = new Date(Math.floor(now.getTime() / (input.windowSeconds * 1000)) * input.windowSeconds * 1000);

  const upserted = await client.query<{ request_count: number }>(
    `INSERT INTO level_up_rate_limit_counters (user_id, command_name, window_started_at, window_seconds, request_count, updated_at)
     VALUES ($1, $2, $3, $4, 1, NOW())
     ON CONFLICT (user_id, command_name, window_started_at, window_seconds)
     DO UPDATE SET request_count = level_up_rate_limit_counters.request_count + 1, updated_at = NOW()
     RETURNING request_count`,
    [input.userId, input.commandName, windowStartedAt, input.windowSeconds],
  );

  const count = Number(upserted.rows[0]?.request_count ?? 0);
  return { allowed: count <= input.limit, count };
}

type CohortFilter = {
  track?: string;
  status?: string;
  startDate?: string;
  seatsAvailableOnly?: boolean;
};

type CohortRow = {
  id: string;
  title: string;
  description: string;
  track: string;
  seats: number;
  start_date: string;
  end_date: string;
  required_credits: string;
  materials_cost: string;
  device_support: boolean;
  status: 'draft' | 'open' | 'active' | 'completed' | 'canceled';
  allow_no_deposit: boolean;
  trainer_split_percent: string;
  completion_bonus_credits: string;
  created_by_user_id: string;
  auto_created?: boolean;
  source_job_title_id?: string | null;
  source_sector?: string | null;
};

function mapCohort(row: CohortRow) {
  const autoCreated = row.auto_created ?? false;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    track: row.track,
    seats: Number(row.seats),
    startDate: row.start_date,
    endDate: row.end_date,
    requiredCredits: toNumber(row.required_credits),
    materialsCost: toNumber(row.materials_cost),
    deviceSupport: row.device_support,
    status: row.status,
    allowNoDeposit: row.allow_no_deposit,
    trainerSplitPercent: toNumber(row.trainer_split_percent),
    completionBonusCredits: toNumber(row.completion_bonus_credits),
    createdByUserId: row.created_by_user_id,
    autoCreated,
    sourceJobTitleId: row.source_job_title_id ?? null,
    sourceSector: row.source_sector ?? null,
    // An auto-created cohort still owned by the scheduler has no human trainer yet.
    needsTrainer: autoCreated && row.created_by_user_id === LEVEL_UP_AUTO_COHORT_ACTOR_ID,
  };
}

type CohortCurriculumItemInput = { title: string; description?: string; required?: boolean };
type CohortMilestoneInput = { name: string; percentRelease: number; requiredTask: string };

type CreateCohortInput = {
  actorId: string;
  idempotencyKey: string;
  title: string;
  description: string;
  track: string;
  seats: number;
  startDate: string;
  endDate: string;
  requiredCredits: number;
  materialsCost?: number;
  deviceSupport?: boolean;
  status?: 'draft' | 'open' | 'active' | 'completed' | 'canceled';
  allowNoDeposit?: boolean;
  trainerSplitPercent?: number;
  completionBonusCredits?: number;
  stipendMode?: 'none' | 'scheduled' | 'milestone';
  stipendAmountPerPayout?: number;
  stipendIntervalDays?: number | null;
  micrograntMode?: 'none' | 'cohort_pool' | 'separate_grant';
  micrograntAmount?: number;
  refundPolicyJson?: Record<string, unknown>;
  payoutPolicyJson?: Record<string, unknown>;
  policyJson?: Record<string, unknown>;
  curriculumItems?: Array<CohortCurriculumItemInput>;
  milestones?: Array<CohortMilestoneInput>;
  autoCreated?: boolean;
  sourceJobTitleId?: string | null;
  sourceSector?: string | null;
  sourceGapAtCreation?: number | null;
};

async function insertCohortRow(client: PoolClient, cohortId: string, input: CreateCohortInput) {
  const status = orDefault(input.status, 'draft');
  const trainerSplitPercent = orDefault(input.trainerSplitPercent, LEVEL_UP_DEFAULT_TRAINER_SPLIT_PERCENT);

  await client.query(
    `INSERT INTO level_up_cohorts
      (id, title, description, track, seats, start_date, end_date, required_credits, materials_cost, device_support, status, allow_no_deposit,
       trainer_split_percent, completion_bonus_credits, stipend_mode, stipend_amount_per_payout, stipend_interval_days, microgrant_mode,
       microgrant_amount, refund_policy_json, payout_policy_json, policy_json, created_by_user_id,
       auto_created, source_job_title_id, source_sector, source_gap_at_creation)
     VALUES
      ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11, $12,
       $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb, $23,
       $24, $25, $26, $27)`,
    [
      cohortId,
      input.title,
      input.description,
      input.track,
      input.seats,
      input.startDate,
      input.endDate,
      input.requiredCredits,
      orDefault(input.materialsCost, 0),
      orDefault(input.deviceSupport, false),
      status,
      orDefault(input.allowNoDeposit, false),
      trainerSplitPercent,
      orDefault(input.completionBonusCredits, 0),
      orDefault(input.stipendMode, 'none'),
      orDefault(input.stipendAmountPerPayout, 0),
      orDefault<number | null>(input.stipendIntervalDays, null),
      orDefault(input.micrograntMode, 'none'),
      orDefault(input.micrograntAmount, 0),
      JSON.stringify(orDefault(input.refundPolicyJson, {})),
      JSON.stringify(orDefault(input.payoutPolicyJson, {})),
      JSON.stringify(orDefault(input.policyJson, {})),
      input.actorId,
      orDefault(input.autoCreated, false),
      orDefault<string | null>(input.sourceJobTitleId, null),
      orDefault<string | null>(input.sourceSector, null),
      orDefault<number | null>(input.sourceGapAtCreation, null),
    ],
  );
}

async function insertCohortCurriculumItems(client: PoolClient, cohortId: string, items: Array<CohortCurriculumItemInput>) {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    await client.query(
      `INSERT INTO level_up_curriculum_items (id, cohort_id, title, description, sequence_no, required)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), cohortId, item.title, orDefault(item.description, ''), i + 1, orDefault(item.required, true)],
    );
  }
}

async function insertCohortMilestones(client: PoolClient, cohortId: string, milestones: Array<CohortMilestoneInput>) {
  for (let i = 0; i < milestones.length; i += 1) {
    const milestone = milestones[i];
    await client.query(
      `INSERT INTO level_up_milestones (id, cohort_id, name, percent_release, required_task, sequence_no)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), cohortId, milestone.name, milestone.percentRelease, milestone.requiredTask, i + 1],
    );
  }
}

async function createCohortTx(client: PoolClient, input: CreateCohortInput) {
  const existing = await readCommandIdempotency<{ cohortId: string }>(client, input.actorId, 'level-up.cohort.create', input.idempotencyKey);
  if (existing) {
    return existing;
  }

  const cohortId = randomUUID();
  await insertCohortRow(client, cohortId, input);
  await insertCohortCurriculumItems(client, cohortId, orDefault(input.curriculumItems, []));
  await insertCohortMilestones(client, cohortId, orDefault(input.milestones, []));

  const response = { cohortId };
  await writeCommandIdempotency(client, input.actorId, 'level-up.cohort.create', input.idempotencyKey, response);
  return response;
}

export async function createCohort(input: CreateCohortInput) {
  if (!input.title || !input.track || input.seats <= 0) {
    throw new Error('invalid_payload');
  }

  return withDbTransaction((client) => createCohortTx(client, input));
}

export async function listCohorts(filter: CohortFilter) {
  const where: string[] = [];
  const values: unknown[] = [];

  if (filter.track) {
    values.push(filter.track);
    where.push(`c.track = $${values.length}`);
  }

  if (filter.status) {
    values.push(filter.status);
    where.push(`c.status = $${values.length}`);
  }

  if (filter.startDate) {
    values.push(filter.startDate);
    where.push(`c.start_date >= $${values.length}::date`);
  }

  if (filter.seatsAvailableOnly) {
    where.push(`(c.seats - COALESCE(e.active_enrollments, 0)) > 0`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const result = await queryDb<CohortRow & { active_enrollments: string }>(
    `SELECT
      c.id::text,
      c.title,
      c.description,
      c.track,
      c.seats,
      c.start_date::text,
      c.end_date::text,
      c.required_credits::text,
      c.materials_cost::text,
      c.device_support,
      c.status,
      c.allow_no_deposit,
      c.trainer_split_percent::text,
      c.completion_bonus_credits::text,
      c.created_by_user_id,
      c.auto_created,
      c.source_job_title_id::text AS source_job_title_id,
      c.source_sector,
      COALESCE(e.active_enrollments, 0)::text AS active_enrollments
     FROM level_up_cohorts c
     LEFT JOIN (
       SELECT cohort_id, COUNT(*)::int AS active_enrollments
       FROM level_up_enrollments
       WHERE status IN ('enrolled', 'active')
       GROUP BY cohort_id
     ) e ON e.cohort_id = c.id
     ${whereSql}
     ORDER BY c.start_date ASC, c.created_at DESC`,
    values,
  );

  return result.rows.map((row) => ({
    ...mapCohort(row),
    seatsAvailable: Number(row.seats) - Number(row.active_enrollments),
  }));
}

export async function getCohortDetail(cohortId: string) {
  const cohort = await queryDb<CohortRow>(
    `SELECT
      id::text,
      title,
      description,
      track,
      seats,
      start_date::text,
      end_date::text,
      required_credits::text,
      materials_cost::text,
      device_support,
      status,
      allow_no_deposit,
      trainer_split_percent::text,
      completion_bonus_credits::text,
      created_by_user_id
     FROM level_up_cohorts
     WHERE id = $1::uuid
     LIMIT 1`,
    [cohortId],
  );

  if (!cohort.rows[0]) {
    throw new Error('not_found');
  }

  const [curriculum, milestones, enrollmentCount] = await Promise.all([
    queryDb<{ id: string; title: string; description: string; sequence_no: number; required: boolean }>(
      `SELECT id::text, title, description, sequence_no, required
       FROM level_up_curriculum_items
       WHERE cohort_id = $1::uuid
       ORDER BY sequence_no ASC`,
      [cohortId],
    ),
    queryDb<{ id: string; name: string; percent_release: string; required_task: string; sequence_no: number }>(
      `SELECT id::text, name, percent_release::text, required_task, sequence_no
       FROM level_up_milestones
       WHERE cohort_id = $1::uuid
       ORDER BY sequence_no ASC`,
      [cohortId],
    ),
    queryDb<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM level_up_enrollments
       WHERE cohort_id = $1::uuid AND status IN ('enrolled', 'active')`,
      [cohortId],
    ),
  ]);

  return {
    ...mapCohort(cohort.rows[0]),
    seatsAvailable: mapCohort(cohort.rows[0]).seats - Number(enrollmentCount.rows[0]?.total ?? '0'),
    curriculum: curriculum.rows.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      sequenceNo: item.sequence_no,
      required: item.required,
    })),
    milestones: milestones.rows.map((item) => ({
      id: item.id,
      name: item.name,
      percentRelease: toNumber(item.percent_release),
      requiredTask: item.required_task,
      sequenceNo: item.sequence_no,
    })),
  };
}

export async function getDisputeCohortId(disputeId: string): Promise<string | null> {
  const result = await queryDb<{ cohort_id: string }>(
    `SELECT e.cohort_id::text AS cohort_id
     FROM level_up_disputes d
     JOIN level_up_enrollments e ON e.id = d.enrollment_id
     WHERE d.id = $1::uuid
     LIMIT 1`,
    [disputeId],
  );

  return result.rows[0]?.cohort_id ?? null;
}

export async function isTrainerForCohort(actorId: string, cohortId: string): Promise<boolean> {
  const cohort = await queryDb<{ created_by_user_id: string }>(
    `SELECT created_by_user_id
     FROM level_up_cohorts
     WHERE id = $1::uuid
     LIMIT 1`,
    [cohortId],
  );

  return cohort.rows[0]?.created_by_user_id === actorId;
}

type EnrollInCohortInput = {
  actorId: string;
  cohortId: string;
  idempotencyKey: string;
  depositCredits?: number;
  allowWithoutDeposit?: boolean;
  assignedTrainerId?: string | null;
};

type EnrollmentCreateResponse = {
  enrollmentId: string;
  status: 'enrolled';
  depositRequested: number;
  milestones: Array<{ id: string; percentRelease: number; sequenceNo: number }>;
};

type EnrollableCohortRow = {
  seats: number;
  status: string;
  required_credits: string;
  allow_no_deposit: boolean;
  created_by_user_id: string;
  auto_created: boolean;
};

async function loadEnrollableCohort(client: PoolClient, cohortId: string): Promise<EnrollableCohortRow> {
  const cohort = await client.query<EnrollableCohortRow>(
    `SELECT seats, status, required_credits::text, allow_no_deposit, created_by_user_id, auto_created
     FROM level_up_cohorts
     WHERE id = $1::uuid
     FOR UPDATE`,
    [cohortId],
  );

  if (!cohort.rows[0]) {
    throw new Error('not_found');
  }

  if (!['open', 'active'].includes(cohort.rows[0].status)) {
    throw new Error('invalid_state');
  }

  return cohort.rows[0];
}

async function assertEnrollmentSeatAvailable(client: PoolClient, cohortId: string, seats: number) {
  const enrolled = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM level_up_enrollments
     WHERE cohort_id = $1::uuid AND status IN ('enrolled', 'active')`,
    [cohortId],
  );

  if (Number(enrolled.rows[0]?.total ?? '0') >= Number(seats)) {
    throw new Error('invalid_state');
  }
}

function resolveEnrollmentDeposit(cohort: EnrollableCohortRow, input: EnrollInCohortInput): number {
  const requiredCredits = toNumber(cohort.required_credits);
  const depositRequested = roundCurrency(orDefault(input.depositCredits, requiredCredits));
  if (!cohort.allow_no_deposit && depositRequested <= 0) {
    throw new Error('invalid_payload');
  }
  if (!cohort.allow_no_deposit && depositRequested < requiredCredits) {
    throw new Error('invalid_payload');
  }
  // A no-deposit cohort with a *nonzero* required amount still needs the caller to explicitly opt
  // into skipping that deposit (allowWithoutDeposit). But a genuinely free cohort (requiredCredits
  // === 0) has nothing to deposit, so a zero deposit is the normal path and must not require the
  // opt-in flag — otherwise one-tap "Enroll" on a 0 SC cohort fails with invalid_payload.
  if (cohort.allow_no_deposit && requiredCredits > 0 && !input.allowWithoutDeposit && depositRequested <= 0) {
    throw new Error('invalid_payload');
  }
  return depositRequested;
}

function resolveEnrollmentTrainerId(cohort: EnrollableCohortRow, input: EnrollInCohortInput): string | null {
  // Trainer of record for the enrollment (drives the milestone-release payout). Prefer an explicitly
  // supplied trainer; otherwise, for an auto-created cohort a trainer has claimed (its
  // created_by_user_id is no longer the scheduler placeholder), default to that claiming trainer so
  // their split actually settles on milestone release. Admin/human-built cohorts get null unless a
  // trainer is passed in (created_by there may be an admin, not the trainer).
  const claimedAutoTrainer =
    cohort.auto_created && cohort.created_by_user_id !== LEVEL_UP_AUTO_COHORT_ACTOR_ID
      ? cohort.created_by_user_id
      : null;
  return input.assignedTrainerId ?? claimedAutoTrainer;
}

async function createEnrollmentDraftTx(client: PoolClient, input: EnrollInCohortInput): Promise<EnrollmentCreateResponse> {
  const existing = await readCommandIdempotency<EnrollmentCreateResponse>(client, input.actorId, 'level-up.enrollment.create', input.idempotencyKey);
  if (existing) {
    return existing;
  }

  const rateLimit = await evaluateRateLimit(client, {
    userId: input.actorId,
    commandName: 'level-up.enrollment.create',
    limit: 6,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    throw new Error('rate_limit_exceeded');
  }

  const cohort = await loadEnrollableCohort(client, input.cohortId);

  const enrollmentExisting = await client.query<{ id: string }>(
    `SELECT id::text
     FROM level_up_enrollments
     WHERE cohort_id = $1::uuid AND user_id = $2
     LIMIT 1`,
    [input.cohortId, input.actorId],
  );
  if (enrollmentExisting.rows[0]) {
    const response: EnrollmentCreateResponse = {
      enrollmentId: enrollmentExisting.rows[0].id,
      status: 'enrolled',
      depositRequested: 0,
      milestones: [],
    };
    await writeCommandIdempotency(client, input.actorId, 'level-up.enrollment.create', input.idempotencyKey, response);
    return response;
  }

  await assertEnrollmentSeatAvailable(client, input.cohortId, cohort.seats);

  const depositRequested = resolveEnrollmentDeposit(cohort, input);
  const resolvedTrainerId = resolveEnrollmentTrainerId(cohort, input);

  const enrollmentId = randomUUID();
  await client.query(
    `INSERT INTO level_up_enrollments (id, cohort_id, user_id, status, credits_deposited, assigned_trainer_id)
     VALUES ($1, $2::uuid, $3, 'enrolled', $4, $5)`,
    [enrollmentId, input.cohortId, input.actorId, Math.max(depositRequested, 0), resolvedTrainerId],
  );

  const milestones = await client.query<{ id: string; percent_release: string; sequence_no: number }>(
    `SELECT id::text, percent_release::text, sequence_no
     FROM level_up_milestones
     WHERE cohort_id = $1::uuid
     ORDER BY sequence_no ASC`,
    [input.cohortId],
  );

  const response: EnrollmentCreateResponse = {
    enrollmentId,
    status: 'enrolled',
    depositRequested,
    milestones: milestones.rows.map((row) => ({
      id: row.id,
      percentRelease: toNumber(row.percent_release),
      sequenceNo: row.sequence_no,
    })),
  };
  await writeCommandIdempotency(client, input.actorId, 'level-up.enrollment.create', input.idempotencyKey, response);
  return response;
}

export async function enrollInCohort(input: EnrollInCohortInput) {
  const draft = await withDbTransaction((client) => createEnrollmentDraftTx(client, input));

  if (draft.depositRequested <= 0) {
    return {
      enrollmentId: draft.enrollmentId,
      status: draft.status,
      creditsDeposited: 0,
      escrowIds: [] as string[],
    };
  }

  const escrowIds: string[] = [];
  let remaining = draft.depositRequested;

  try {
    for (let i = 0; i < draft.milestones.length; i += 1) {
      const milestone = draft.milestones[i];
      const isLast = i === draft.milestones.length - 1;
      const amount = isLast ? roundCurrency(remaining) : roundCurrency((draft.depositRequested * milestone.percentRelease) / 100);
      remaining = roundCurrency(remaining - amount);
      if (amount <= 0) {
        continue;
      }

      const hold = await createEscrowHold({
        actorId: input.actorId,
        sourceUserId: input.actorId,
        amount,
        originPlugin: LEVEL_UP_PLUGIN_SLUG,
        releasePolicy: 'levelup_milestone_validated',
        idempotencyKey: `${input.idempotencyKey}:hold:${milestone.id}`,
      });

      escrowIds.push(hold.escrowId);

      await queryDb(
        `INSERT INTO level_up_enrollment_milestone_escrows (id, enrollment_id, milestone_id, escrow_id, held_amount, release_status)
         VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, 'held')
         ON CONFLICT (enrollment_id, milestone_id)
         DO UPDATE SET escrow_id = EXCLUDED.escrow_id, held_amount = EXCLUDED.held_amount, release_status = 'held', updated_at = NOW()`,
        [randomUUID(), draft.enrollmentId, milestone.id, hold.escrowId, amount],
      );
    }
  } catch (error) {
    for (const escrowId of escrowIds) {
      try {
        await refundEscrow({
          actorId: input.actorId,
          escrowId,
          refundReason: 'levelup_enrollment_setup_failed',
          originPlugin: LEVEL_UP_PLUGIN_SLUG,
          idempotencyKey: `${input.idempotencyKey}:rollback:${escrowId}`,
        });
      } catch {
        // no-trace: best-effort rollback for escrows that are already held.
      }
    }

    await queryDb(
      `UPDATE level_up_enrollments
       SET status = 'dropped', updated_at = NOW()
       WHERE id = $1::uuid`,
      [draft.enrollmentId],
    );

    throw error;
  }

  return {
    enrollmentId: draft.enrollmentId,
    status: draft.status,
    creditsDeposited: draft.depositRequested,
    escrowIds,
  };
}

export async function validateMilestone(input: {
  actorId: string;
  enrollmentId: string;
  milestoneId: string;
  validationNote?: string;
  idempotencyKey: string;
}) {
  return withDbTransaction(async (client: PoolClient) => {
    const existing = await readCommandIdempotency<{ validationId: string; status: 'validated' }>(
      client,
      input.actorId,
      'level-up.milestone.validate',
      input.idempotencyKey,
    );
    if (existing) {
      return existing;
    }

    const rateLimit = await evaluateRateLimit(client, {
      userId: input.actorId,
      commandName: 'level-up.milestone.validate',
      limit: 20,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
      throw new Error('rate_limit_exceeded');
    }

    const validationId = randomUUID();
    await client.query(
      `INSERT INTO level_up_milestone_validations (id, enrollment_id, milestone_id, validated_by_user_id, validation_note, status)
       VALUES ($1, $2::uuid, $3::uuid, $4, $5, 'validated')
       ON CONFLICT (enrollment_id, milestone_id)
       DO UPDATE SET
         validated_by_user_id = EXCLUDED.validated_by_user_id,
         validation_note = EXCLUDED.validation_note,
         status = 'validated',
         validated_at = NOW(),
         released_at = NULL`,
      [validationId, input.enrollmentId, input.milestoneId, input.actorId, input.validationNote ?? ''],
    );

    const response = { validationId, status: 'validated' as const };
    await writeCommandIdempotency(client, input.actorId, 'level-up.milestone.validate', input.idempotencyKey, response);
    return response;
  });
}

type ReleaseMilestoneInput = {
  actorId: string;
  enrollmentId: string;
  milestoneId: string;
  idempotencyKey: string;
};

type MilestoneReleaseDraft = {
  enrollmentId: string;
  milestoneId: string;
  escrowId: string;
  recipientUserId: string;
  trainerUserId: string | null;
  cohortId: string;
  releasedAmount: number;
  trainerPayoutAmount: number;
  completionBonusAmount: number;
  isFinalMilestone: boolean;
};

type MilestoneReleaseResponse = {
  enrollmentId: string;
  milestoneId: string;
  // The learner the released credits go to — surfaced so the route can notify them.
  recipientUserId: string;
  userTransferId: string;
  trainerPayoutGovernanceId: string | null;
  completionBonusGovernanceId: string | null;
  releasedAmount: number;
  trainerPayoutAmount: number;
  completionBonusAmount: number;
};

type ReleaseEnrollmentRow = {
  user_id: string;
  assigned_trainer_id: string | null;
  cohort_id: string;
  status: string;
};

type ReleaseEscrowRow = { escrow_id: string; held_amount: string; release_status: string };
type ReleaseCohortRow = { trainer_split_percent: string; completion_bonus_credits: string };

async function assertMilestoneReleasable(client: PoolClient, enrollmentId: string, milestoneId: string) {
  const validation = await client.query<{ status: string }>(
    `SELECT status
     FROM level_up_milestone_validations
     WHERE enrollment_id = $1::uuid AND milestone_id = $2::uuid
     FOR UPDATE`,
    [enrollmentId, milestoneId],
  );

  if (!validation.rows[0]) {
    throw new Error('not_found');
  }

  if (validation.rows[0].status === 'released') {
    throw new Error('invalid_state');
  }

  if (validation.rows[0].status !== 'validated') {
    throw new Error('invalid_state');
  }
}

async function loadEnrollmentForRelease(client: PoolClient, enrollmentId: string): Promise<ReleaseEnrollmentRow> {
  const enrollment = await client.query<ReleaseEnrollmentRow>(
    `SELECT user_id, assigned_trainer_id, cohort_id::text, status
     FROM level_up_enrollments
     WHERE id = $1::uuid
     FOR UPDATE`,
    [enrollmentId],
  );

  if (!enrollment.rows[0]) {
    throw new Error('not_found');
  }

  return enrollment.rows[0];
}

async function loadHeldEscrowForRelease(client: PoolClient, enrollmentId: string, milestoneId: string): Promise<ReleaseEscrowRow> {
  const escrow = await client.query<ReleaseEscrowRow>(
    `SELECT escrow_id::text, held_amount::text, release_status
     FROM level_up_enrollment_milestone_escrows
     WHERE enrollment_id = $1::uuid AND milestone_id = $2::uuid
     FOR UPDATE`,
    [enrollmentId, milestoneId],
  );

  if (!escrow.rows[0]) {
    throw new Error('not_found');
  }

  if (escrow.rows[0].release_status !== 'held') {
    throw new Error('invalid_state');
  }

  return escrow.rows[0];
}

async function loadCohortForRelease(client: PoolClient, cohortId: string): Promise<ReleaseCohortRow> {
  const cohort = await client.query<ReleaseCohortRow>(
    `SELECT trainer_split_percent::text, completion_bonus_credits::text
     FROM level_up_cohorts
     WHERE id = $1::uuid
     LIMIT 1`,
    [cohortId],
  );

  if (!cohort.rows[0]) {
    throw new Error('not_found');
  }

  return cohort.rows[0];
}

async function isFinalMilestoneForEnrollment(client: PoolClient, enrollmentId: string, cohortId: string): Promise<boolean> {
  const allMilestones = await client.query<{ total: string; released: string }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE v.status = 'released')::text AS released
     FROM level_up_milestones m
     LEFT JOIN level_up_milestone_validations v
       ON v.milestone_id = m.id AND v.enrollment_id = $1::uuid
     WHERE m.cohort_id = $2::uuid`,
    [enrollmentId, cohortId],
  );

  const totalMilestones = Number(allMilestones.rows[0]?.total ?? '0');
  const alreadyReleased = Number(allMilestones.rows[0]?.released ?? '0');
  return totalMilestones > 0 && alreadyReleased + 1 >= totalMilestones;
}

async function buildMilestoneReleaseDraft(client: PoolClient, input: ReleaseMilestoneInput): Promise<MilestoneReleaseDraft> {
  await assertMilestoneReleasable(client, input.enrollmentId, input.milestoneId);
  const enrollment = await loadEnrollmentForRelease(client, input.enrollmentId);
  const escrow = await loadHeldEscrowForRelease(client, input.enrollmentId, input.milestoneId);
  const cohort = await loadCohortForRelease(client, enrollment.cohort_id);

  const heldAmount = toNumber(escrow.held_amount);
  const trainerSplitPercent = toNumber(cohort.trainer_split_percent);
  const trainerPayoutAmount = calculateTrainerPayout(heldAmount, trainerSplitPercent);

  const isFinalMilestone = await isFinalMilestoneForEnrollment(client, input.enrollmentId, enrollment.cohort_id);

  return {
    enrollmentId: input.enrollmentId,
    milestoneId: input.milestoneId,
    escrowId: escrow.escrow_id,
    recipientUserId: enrollment.user_id,
    trainerUserId: enrollment.assigned_trainer_id,
    cohortId: enrollment.cohort_id,
    releasedAmount: heldAmount,
    trainerPayoutAmount,
    completionBonusAmount: isFinalMilestone ? toNumber(cohort.completion_bonus_credits) : 0,
    isFinalMilestone,
  };
}

export async function releaseMilestoneCredits(input: ReleaseMilestoneInput) {
  const existingRelease = await queryDb<{ response_payload: MilestoneReleaseResponse }>(
    `SELECT response_payload
     FROM level_up_command_idempotency
     WHERE actor_id = $1 AND command_name = 'level-up.milestone.release' AND idempotency_key = $2
     LIMIT 1`,
    [input.actorId, input.idempotencyKey],
  );
  if (existingRelease.rows[0]?.response_payload) {
    return existingRelease.rows[0].response_payload;
  }

  const releaseDraft = await withDbTransaction((client) => buildMilestoneReleaseDraft(client, input));

  // Business rule: milestone release returns escrowed credits to the learner first.
  const userRelease = await releaseEscrow({
    actorId: input.actorId,
    escrowId: releaseDraft.escrowId,
    destinationUserId: releaseDraft.recipientUserId,
    releaseReason: 'levelup_milestone_validated',
    originPlugin: LEVEL_UP_PLUGIN_SLUG,
    idempotencyKey: `${input.idempotencyKey}:escrow-release`,
  });

  let trainerPayoutGovernanceId: string | null = null;
  if (releaseDraft.trainerUserId && releaseDraft.trainerPayoutAmount > 0) {
    // Business rule: trainer split is paid as a governed credit payout for validated work.
    const trainerPayout = await mintGrant({
      actorId: input.actorId,
      targetUserId: releaseDraft.trainerUserId,
      amount: releaseDraft.trainerPayoutAmount,
      grantReason: 'levelup_trainer_split',
      governanceTicketId: `levelup:${releaseDraft.cohortId}:trainer:${releaseDraft.milestoneId}`,
      idempotencyKey: `${input.idempotencyKey}:trainer-payout`,
    });
    trainerPayoutGovernanceId = trainerPayout.governanceEventId;
  }

  let completionBonusGovernanceId: string | null = null;
  if (releaseDraft.completionBonusAmount > 0) {
    const bonus = await mintGrant({
      actorId: input.actorId,
      targetUserId: releaseDraft.recipientUserId,
      amount: releaseDraft.completionBonusAmount,
      grantReason: 'levelup_completion_bonus',
      governanceTicketId: `levelup:${releaseDraft.cohortId}:completion:${releaseDraft.enrollmentId}`,
      idempotencyKey: `${input.idempotencyKey}:completion-bonus`,
    });
    completionBonusGovernanceId = bonus.governanceEventId;
  }

  const response = await withDbTransaction(async (client: PoolClient) => {
    await client.query(
      `UPDATE level_up_enrollment_milestone_escrows
       SET release_status = 'released', updated_at = NOW()
       WHERE enrollment_id = $1::uuid AND milestone_id = $2::uuid`,
      [input.enrollmentId, input.milestoneId],
    );

    await client.query(
      `UPDATE level_up_milestone_validations
       SET status = 'released', released_at = NOW(), release_transfer_id = $3::uuid, trainer_payout_governance_id = $4::uuid
       WHERE enrollment_id = $1::uuid AND milestone_id = $2::uuid`,
      [input.enrollmentId, input.milestoneId, userRelease.transferId, trainerPayoutGovernanceId],
    );

    if (releaseDraft.isFinalMilestone) {
      await client.query(
        `UPDATE level_up_enrollments
         SET status = 'completed', progress_percent = 100, updated_at = NOW()
         WHERE id = $1::uuid`,
        [input.enrollmentId],
      );
    }

    const output = {
      enrollmentId: input.enrollmentId,
      milestoneId: input.milestoneId,
      recipientUserId: releaseDraft.recipientUserId,
      userTransferId: userRelease.transferId,
      trainerPayoutGovernanceId,
      completionBonusGovernanceId,
      releasedAmount: releaseDraft.releasedAmount,
      trainerPayoutAmount: releaseDraft.trainerPayoutAmount,
      completionBonusAmount: releaseDraft.completionBonusAmount,
    };

    await writeCommandIdempotency(client, input.actorId, 'level-up.milestone.release', input.idempotencyKey, output);
    return output;
  });

  return response;
}

export async function transferCreditsForLevelUp(input: {
  actorId: string;
  recipientUserId: string;
  amount: number;
  idempotencyKey: string;
  reasonCode?: string;
}) {
  ensurePositiveAmount(input.amount);
  return createTransfer({
    senderUserId: input.actorId,
    recipientUserId: input.recipientUserId,
    amount: input.amount,
    idempotencyKey: input.idempotencyKey,
    originPlugin: LEVEL_UP_PLUGIN_SLUG,
    reasonCode: input.reasonCode ?? 'levelup_transfer',
  });
}

export async function openDispute(input: {
  actorId: string;
  isAdmin?: boolean;
  enrollmentId: string;
  milestoneId?: string;
  title: string;
  description: string;
  attachments?: string[];
  idempotencyKey: string;
}) {
  return withDbTransaction(async (client: PoolClient) => {
    const existing = await readCommandIdempotency<{ disputeId: string }>(client, input.actorId, 'level-up.dispute.open', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    // Ownership guard (per the dispute.open access policy: `enrollment_not_visible` is a deny
    // condition). Only the enrollment's learner, its assigned trainer, or an admin may open a
    // dispute on it — otherwise any authenticated member who guessed an enrollment UUID could
    // file a dispute against someone else's enrollment and flip its milestone validations to
    // 'disputed'. Enforced here at the repository so every caller is covered.
    const enrollment = await client.query<{ user_id: string; assigned_trainer_id: string | null }>(
      `SELECT user_id, assigned_trainer_id
       FROM level_up_enrollments
       WHERE id = $1::uuid`,
      [input.enrollmentId],
    );
    if (!enrollment.rows[0]) {
      throw new Error('not_found');
    }
    const isParty =
      enrollment.rows[0].user_id === input.actorId ||
      enrollment.rows[0].assigned_trainer_id === input.actorId;
    if (!input.isAdmin && !isParty) {
      throw new Error('forbidden');
    }

    const disputeId = randomUUID();
    await client.query(
      `INSERT INTO level_up_disputes (id, enrollment_id, milestone_id, opened_by_user_id, title, description)
       VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6)`,
      [disputeId, input.enrollmentId, input.milestoneId ?? null, input.actorId, input.title, input.description],
    );

    await client.query(
      `INSERT INTO level_up_dispute_comments (id, dispute_id, actor_user_id, body, attachment_urls)
       VALUES ($1, $2::uuid, $3, $4, $5::jsonb)`,
      [randomUUID(), disputeId, input.actorId, input.description, JSON.stringify(input.attachments ?? [])],
    );

    if (input.milestoneId) {
      await client.query(
        `UPDATE level_up_milestone_validations
         SET status = 'disputed'
         WHERE enrollment_id = $1::uuid AND milestone_id = $2::uuid`,
        [input.enrollmentId, input.milestoneId],
      );
    }

    const response = { disputeId };
    await writeCommandIdempotency(client, input.actorId, 'level-up.dispute.open', input.idempotencyKey, response);
    return response;
  });
}

export async function resolveDispute(input: {
  actorId: string;
  disputeId: string;
  resolutionComment: string;
  attachments?: string[];
  adjustment?: {
    sourceUserId: string;
    destinationUserId: string;
    amount: number;
    reason: string;
  };
  idempotencyKey: string;
}) {
  type ResolveDisputeResponse = {
    disputeId: string;
    adjustmentId: string | null;
    transferId: string | null;
    status: 'resolved';
  };

  // Idempotency-first: if this command already ran under the same key, return the stored response
  // WITHOUT re-running applyDisputeAdjustment. Previously the adjustment (a real credit transfer)
  // ran before the in-transaction idempotency check, so a retry re-invoked it — relying solely on
  // the credits layer's sub-key to avoid a double transfer. Mirrors releaseMilestoneCredits.
  const existingResolve = await queryDb<{ response_payload: ResolveDisputeResponse }>(
    `SELECT response_payload
     FROM level_up_command_idempotency
     WHERE actor_id = $1 AND command_name = 'level-up.dispute.resolve' AND idempotency_key = $2
     LIMIT 1`,
    [input.actorId, input.idempotencyKey],
  );
  if (existingResolve.rows[0]?.response_payload) {
    return existingResolve.rows[0].response_payload;
  }

  let adjustmentResult: Awaited<ReturnType<typeof applyDisputeAdjustment>> | null = null;

  if (input.adjustment && input.adjustment.amount > 0) {
    adjustmentResult = await applyDisputeAdjustment({
      actorId: input.actorId,
      disputeCaseId: input.disputeId,
      sourceUserId: input.adjustment.sourceUserId,
      destinationUserId: input.adjustment.destinationUserId,
      amount: input.adjustment.amount,
      adjustmentReason: input.adjustment.reason,
      idempotencyKey: `${input.idempotencyKey}:adjustment`,
    });
  }

  return withDbTransaction(async (client: PoolClient) => {
    const existing = await readCommandIdempotency<{
      disputeId: string;
      adjustmentId: string | null;
      transferId: string | null;
      status: 'resolved';
    }>(client, input.actorId, 'level-up.dispute.resolve', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const dispute = await client.query(
      `UPDATE level_up_disputes
       SET status = 'resolved', resolution_comment = $2, resolved_by_user_id = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING enrollment_id::text, milestone_id::text`,
      [input.disputeId, input.resolutionComment, input.actorId],
    );

    if (!dispute.rows[0]) {
      throw new Error('not_found');
    }

    await client.query(
      `INSERT INTO level_up_dispute_comments (id, dispute_id, actor_user_id, body, attachment_urls)
       VALUES ($1, $2::uuid, $3, $4, $5::jsonb)`,
      [randomUUID(), input.disputeId, input.actorId, input.resolutionComment, JSON.stringify(input.attachments ?? [])],
    );

    if (dispute.rows[0].milestone_id) {
      await client.query(
        `UPDATE level_up_milestone_validations
         SET status = CASE WHEN status = 'disputed' THEN 'validated' ELSE status END
         WHERE enrollment_id = $1::uuid AND milestone_id = $2::uuid`,
        [dispute.rows[0].enrollment_id, dispute.rows[0].milestone_id],
      );
    }

    const response = {
      disputeId: input.disputeId,
      adjustmentId: adjustmentResult?.adjustmentId ?? null,
      transferId: adjustmentResult?.transferId ?? null,
      status: 'resolved' as const,
    };

    await writeCommandIdempotency(client, input.actorId, 'level-up.dispute.resolve', input.idempotencyKey, response);
    return response;
  });
}

export async function adminAdjustCredits(input: {
  actorId: string;
  targetUserId: string;
  amount: number;
  reason: string;
  governanceTicketId: string;
  idempotencyKey: string;
}) {
  ensurePositiveAmount(Math.abs(input.amount));

  if (input.amount >= 0) {
    return mintGrant({
      actorId: input.actorId,
      targetUserId: input.targetUserId,
      amount: input.amount,
      grantReason: input.reason,
      governanceTicketId: input.governanceTicketId,
      idempotencyKey: input.idempotencyKey,
    });
  }

  return applyDisputeAdjustment({
    actorId: input.actorId,
    disputeCaseId: `admin-adjust-${input.governanceTicketId}`,
    sourceUserId: input.targetUserId,
    destinationUserId: 'level-up-treasury',
    amount: Math.abs(input.amount),
    adjustmentReason: input.reason,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function getWalletOverview(userId: string) {
  const wallet = await getOrCreateWallet(userId);

  const escrowed = await queryDb<{ total: string }>(
    `SELECT COALESCE(SUM(held_amount), 0)::text AS total
     FROM level_up_enrollment_milestone_escrows e
     JOIN level_up_enrollments n ON n.id = e.enrollment_id
     WHERE n.user_id = $1 AND e.release_status = 'held'`,
    [userId],
  );

  return {
    availableBalance: wallet.availableBalance,
    walletEscrowBalance: wallet.escrowBalance,
    levelUpEscrowedBalance: Number(escrowed.rows[0]?.total ?? '0'),
  };
}

export async function getUserDashboardData(userId: string) {
  const [wallet, enrollments, transactions] = await Promise.all([
    getWalletOverview(userId),
    queryDb<{
      id: string;
      cohort_id: string;
      status: string;
      progress_percent: string;
      assigned_trainer_id: string | null;
      title: string;
      track: string;
    }>(
      `SELECT n.id::text, n.cohort_id::text, n.status, n.progress_percent::text, n.assigned_trainer_id, c.title, c.track
       FROM level_up_enrollments n
       JOIN level_up_cohorts c ON c.id = n.cohort_id
       WHERE n.user_id = $1
       ORDER BY n.enrolled_at DESC
       LIMIT 20`,
      [userId],
    ),
    queryDb<{ id: string; entry_type: string; amount: string; reference_type: string; created_at: Date }>(
      `SELECT id::text, entry_type, amount::text, reference_type, created_at
       FROM service_credits_ledger_entries
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    ),
  ]);

  return {
    wallet,
    activeEnrollments: enrollments.rows.map((row) => ({
      id: row.id,
      cohortId: row.cohort_id,
      title: row.title,
      track: row.track,
      status: row.status,
      progress: toNumber(row.progress_percent),
      assignedTrainerId: row.assigned_trainer_id,
    })),
    recentTransactions: transactions.rows.map((row) => ({
      id: row.id,
      type: row.entry_type,
      amount: toNumber(row.amount),
      referenceType: row.reference_type,
      createdAtIso: row.created_at.toISOString(),
    })),
  };
}

// The signed-in member's own enrollments, with a milestone tally per row.
//
// Why this exists: the member shell used to hold enrollments only in React state, so it knew about an
// enrollment only if you made it in that same visit. On a fresh page load the member saw "0 enrolled"
// and an empty Progress tab while the admin panel counted the very same rows — the mismatch the owner
// reported. This is the read that lets the member side count from the same table the admin counts.
//
// `enrolled`/`active` are the two statuses a live enrollment carries (`enrolled` is what
// `createEnrollmentDraftTx` writes; `active` is the legacy value); `completed` and `dropped` are the
// terminal ones. All are returned — the caller decides what to show — and `isCurrent` marks the live
// ones so a count of "cohorts I am in" never quietly includes one I dropped.
export async function listMemberEnrollments(userId: string) {
  const result = await queryDb<{
    enrollment_id: string;
    cohort_id: string;
    status: string;
    title: string;
    track: string;
    trainer_name: string | null;
    milestone_total: number;
    milestone_completed: number;
  }>(
    `SELECT
       n.id::text AS enrollment_id,
       n.cohort_id::text AS cohort_id,
       n.status,
       c.title,
       c.track,
       t.display_name AS trainer_name,
       COUNT(e.milestone_id)::int AS milestone_total,
       COUNT(*) FILTER (WHERE v.status IN ('validated', 'released'))::int AS milestone_completed
     FROM level_up_enrollments n
     JOIN level_up_cohorts c ON c.id = n.cohort_id
     LEFT JOIN level_up_trainers t ON t.user_id = n.assigned_trainer_id
     LEFT JOIN level_up_enrollment_milestone_escrows e ON e.enrollment_id = n.id
     LEFT JOIN level_up_milestone_validations v
       ON v.enrollment_id = e.enrollment_id AND v.milestone_id = e.milestone_id
     WHERE n.user_id = $1
     GROUP BY n.id, n.cohort_id, n.status, n.enrolled_at, c.title, c.track, t.display_name
     ORDER BY n.enrolled_at DESC
     LIMIT 50`,
    [userId],
  );

  return result.rows.map((row) => ({
    enrollmentId: row.enrollment_id,
    cohortId: row.cohort_id,
    status: row.status,
    isCurrent: row.status === 'enrolled' || row.status === 'active',
    title: row.title,
    track: row.track,
    trainerName: row.trainer_name,
    milestoneTotal: Number(row.milestone_total),
    milestoneCompleted: Number(row.milestone_completed),
  }));
}

export async function getTrainerDashboardData(trainerUserId: string) {
  const [cohorts, pendingValidations, trainees, payouts] = await Promise.all([
    queryDb<{ id: string; title: string; status: string; track: string }>(
      `SELECT id::text, title, status, track
       FROM level_up_cohorts
       WHERE created_by_user_id = $1
       ORDER BY created_at DESC`,
      [trainerUserId],
    ),
    queryDb<{ enrollment_id: string; milestone_id: string; validated_at: Date; title: string; milestone_name: string }>(
      `SELECT v.enrollment_id::text, v.milestone_id::text, v.validated_at, c.title, m.name AS milestone_name
       FROM level_up_milestone_validations v
       JOIN level_up_enrollments e ON e.id = v.enrollment_id
       JOIN level_up_cohorts c ON c.id = e.cohort_id
       JOIN level_up_milestones m ON m.id = v.milestone_id
       WHERE c.created_by_user_id = $1 AND v.status = 'validated'
       ORDER BY v.validated_at ASC
       LIMIT 50`,
      [trainerUserId],
    ),
    queryDb<{ enrollment_id: string; user_id: string; title: string; status: string; progress_percent: string }>(
      `SELECT e.id::text AS enrollment_id, e.user_id, c.title, e.status, e.progress_percent::text
       FROM level_up_enrollments e
       JOIN level_up_cohorts c ON c.id = e.cohort_id
       WHERE c.created_by_user_id = $1
       ORDER BY e.enrolled_at DESC
       LIMIT 100`,
      [trainerUserId],
    ),
    queryDb<{ id: string; amount: string; created_at: Date; metadata: string }>(
      `SELECT id::text, amount::text, created_at, metadata::text
       FROM level_up_disbursements
       WHERE recipient_user_id = $1 AND disbursement_type = 'trainer_payout'
       ORDER BY created_at DESC
       LIMIT 50`,
      [trainerUserId],
    ),
  ]);

  return {
    cohorts: cohorts.rows,
    pendingValidations: pendingValidations.rows.map((row) => ({
      enrollmentId: row.enrollment_id,
      milestoneId: row.milestone_id,
      title: row.title,
      milestoneName: row.milestone_name,
      validatedAtIso: row.validated_at.toISOString(),
    })),
    trainees: trainees.rows.map((row) => ({
      enrollmentId: row.enrollment_id,
      userId: row.user_id,
      cohortTitle: row.title,
      status: row.status,
      progress: toNumber(row.progress_percent),
    })),
    payoutLedger: payouts.rows.map((row) => ({
      id: row.id,
      amount: toNumber(row.amount),
      metadata: JSON.parse(row.metadata),
      createdAtIso: row.created_at.toISOString(),
    })),
  };
}

// One open dispute in the admin review queue. `openedByName` is the resolved display name (null when
// it can't be resolved — the UI falls back to a short id). `cohortId` lets the admin jump to the cohort.
export type LevelUpAdminDispute = {
  id: string;
  enrollmentId: string;
  cohortId: string | null;
  title: string;
  description: string;
  openedByUserId: string;
  openedByName: string | null;
  createdAtIso: string;
};

// One pending milestone validation awaiting an admin/trainer decision.
export type LevelUpAdminValidation = {
  id: string;
  enrollmentId: string;
  cohortId: string | null;
  milestoneId: string;
  validationNote: string | null;
  createdAtIso: string;
};

type AdminDisputeRow = {
  id: string;
  enrollment_id: string;
  cohort_id: string | null;
  title: string;
  description: string;
  opened_by_user_id: string;
  created_at: Date;
};

type AdminValidationRow = {
  id: string;
  enrollment_id: string;
  cohort_id: string | null;
  milestone_id: string;
  validation_note: string | null;
  created_at: Date;
};

// Admin-only: open disputes, newest first (capped). Resolves opener display names in one batched
// Clerk lookup. Backs the admin "Open disputes" review list and the admin-landing dot.
export async function listOpenDisputes(limit = 100): Promise<LevelUpAdminDispute[]> {
  const pageSize = Math.min(Math.max(1, limit), 200);
  const result = await queryDb<AdminDisputeRow>(
    `SELECT d.id, d.enrollment_id, e.cohort_id, d.title, d.description, d.opened_by_user_id, d.created_at
       FROM level_up_disputes d
       LEFT JOIN level_up_enrollments e ON e.id = d.enrollment_id
       WHERE d.status = 'open'
       ORDER BY d.created_at DESC
       LIMIT $1`,
    [pageSize],
  );
  const names = await resolveUsernames(result.rows.map((row) => row.opened_by_user_id));
  return result.rows.map((row) => ({
    id: row.id,
    enrollmentId: row.enrollment_id,
    cohortId: row.cohort_id,
    title: row.title,
    description: row.description,
    openedByUserId: row.opened_by_user_id,
    openedByName: names.get(row.opened_by_user_id) ?? null,
    createdAtIso: row.created_at.toISOString(),
  }));
}

// Admin-only: pending milestone validations, newest first (capped). Backs the admin "Pending
// validations" review list and the admin-landing dot.
export async function listPendingMilestoneValidations(limit = 100): Promise<LevelUpAdminValidation[]> {
  const pageSize = Math.min(Math.max(1, limit), 200);
  const result = await queryDb<AdminValidationRow>(
    `SELECT v.id, v.enrollment_id, e.cohort_id, v.milestone_id, v.validation_note, v.created_at
       FROM level_up_milestone_validations v
       LEFT JOIN level_up_enrollments e ON e.id = v.enrollment_id
       WHERE v.status = 'pending'
       ORDER BY v.created_at DESC
       LIMIT $1`,
    [pageSize],
  );
  return result.rows.map((row) => ({
    id: row.id,
    enrollmentId: row.enrollment_id,
    cohortId: row.cohort_id,
    milestoneId: row.milestone_id,
    validationNote: row.validation_note,
    createdAtIso: row.created_at.toISOString(),
  }));
}

export async function getAdminPanelData() {
  const [enrollmentCounts, avgLeadDays, openDisputes, pendingValidations] = await Promise.all([
    // One pass over the enrollment rows for every headline number, so the counts can never disagree
    // with each other. `enrollments` is every row ever written (a member who joins three cohorts
    // contributes three), `membersEnrolled` is how many distinct people are in a cohort right now —
    // those are different questions and the panel used to answer only the first while labeling it
    // ambiguously, which is how a row count got read as a headcount.
    queryDb<{ total: string; current_total: string; current_members: string; completed_total: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status IN ('enrolled', 'active'))::text AS current_total,
         COUNT(DISTINCT user_id) FILTER (WHERE status IN ('enrolled', 'active'))::text AS current_members,
         COUNT(*) FILTER (WHERE status = 'completed')::text AS completed_total
       FROM level_up_enrollments`,
    ),
    queryDb<{ avg_days: string }>(
      `WITH first_trainer_payout AS (
         SELECT enrollment_id, MIN(created_at) AS first_payout_at
         FROM level_up_disbursements
         WHERE disbursement_type = 'trainer_payout'
         GROUP BY enrollment_id
       )
       SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (f.first_payout_at - e.enrolled_at)) / 86400), 0)::text AS avg_days
       FROM level_up_enrollments e
       JOIN first_trainer_payout f ON f.enrollment_id = e.id
       WHERE f.first_payout_at >= e.enrolled_at`,
    ),
    listOpenDisputes(100),
    listPendingMilestoneValidations(100),
  ]);

  return {
    kpis: {
      enrollments: Number(enrollmentCounts.rows[0]?.total ?? '0'),
      activeEnrollments: Number(enrollmentCounts.rows[0]?.current_total ?? '0'),
      membersEnrolled: Number(enrollmentCounts.rows[0]?.current_members ?? '0'),
      completions: Number(enrollmentCounts.rows[0]?.completed_total ?? '0'),
      avgDaysToFirstTrainerPayout: roundCurrency(Number(avgLeadDays.rows[0]?.avg_days ?? '0')),
    },
    openDisputes,
    pendingValidations,
  };
}

// === Trainers directory (read-only browse) ===
type TrainerRow = {
  id: string;
  user_id: string;
  display_name: string;
  headline: string;
  bio: string;
  tracks: unknown;
  status: string;
  cohort_count: string;
};

export async function listTrainers(filter: { track?: string } = {}) {
  const where: string[] = [`t.status = 'active'`];
  const values: unknown[] = [];

  if (filter.track) {
    values.push(filter.track);
    where.push(`t.tracks ? $${values.length}`);
  }

  const result = await queryDb<TrainerRow>(
    `SELECT
       t.id::text,
       t.user_id,
       t.display_name,
       t.headline,
       t.bio,
       t.tracks,
       t.status,
       COALESCE(c.cohort_count, 0)::text AS cohort_count
     FROM level_up_trainers t
     LEFT JOIN (
       SELECT created_by_user_id, COUNT(*)::int AS cohort_count
       FROM level_up_cohorts
       WHERE status IN ('open', 'active')
       GROUP BY created_by_user_id
     ) c ON c.created_by_user_id = t.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.display_name ASC`,
    values,
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
    tracks: Array.isArray(row.tracks) ? (row.tracks as string[]) : [],
    status: row.status,
    activeCohortCount: Number(row.cohort_count),
  }));
}

// === Achievements (grant-only badges) ===
type AchievementRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  track: string;
  icon: string;
  credit_reward: string;
  sequence_no: number;
  earned_at: Date | null;
  granted_credits: string | null;
};

export async function listAchievementsForUser(userId: string) {
  const result = await queryDb<AchievementRow>(
    `SELECT
       a.id::text,
       a.slug,
       a.name,
       a.description,
       a.track,
       a.icon,
       a.credit_reward::text,
       a.sequence_no,
       ua.earned_at,
       ua.granted_credits::text
     FROM level_up_achievements a
     LEFT JOIN level_up_user_achievements ua
       ON ua.achievement_id = a.id AND ua.user_id = $1
     WHERE a.status = 'active'
     ORDER BY a.sequence_no ASC, a.name ASC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    track: row.track,
    icon: row.icon,
    creditReward: toNumber(row.credit_reward),
    sequenceNo: row.sequence_no,
    earned: row.earned_at != null,
    earnedAtIso: row.earned_at ? row.earned_at.toISOString() : null,
    grantedCredits: row.granted_credits != null ? toNumber(row.granted_credits) : 0,
  }));
}

// === Wallet view: balance + grant-only earned history ===
// LevelUp is grant-only: this surface only reads credits earned/granted
// through LevelUp. It never spends or deducts a user's ServiceCredits.
export async function getLevelUpWalletView(userId: string) {
  const wallet = await getWalletOverview(userId);

  const [milestoneReleases, disbursements, achievementGrants] = await Promise.all([
    queryDb<{ kind: string; amount: string; label: string; earned_at: Date }>(
      `SELECT 'milestone_release' AS kind, e.held_amount::text AS amount, c.title AS label, v.released_at AS earned_at
       FROM level_up_milestone_validations v
       JOIN level_up_enrollments n ON n.id = v.enrollment_id
       JOIN level_up_cohorts c ON c.id = n.cohort_id
       JOIN level_up_enrollment_milestone_escrows e ON e.enrollment_id = v.enrollment_id AND e.milestone_id = v.milestone_id
       WHERE n.user_id = $1 AND v.status = 'released' AND v.released_at IS NOT NULL`,
      [userId],
    ),
    queryDb<{ kind: string; amount: string; label: string; earned_at: Date }>(
      `SELECT d.disbursement_type AS kind, d.amount::text AS amount, c.title AS label, d.created_at AS earned_at
       FROM level_up_disbursements d
       JOIN level_up_enrollments n ON n.id = d.enrollment_id
       JOIN level_up_cohorts c ON c.id = n.cohort_id
       WHERE d.recipient_user_id = $1`,
      [userId],
    ),
    queryDb<{ kind: string; amount: string; label: string; earned_at: Date }>(
      `SELECT 'achievement' AS kind, ua.granted_credits::text AS amount, a.name AS label, ua.earned_at
       FROM level_up_user_achievements ua
       JOIN level_up_achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = $1`,
      [userId],
    ),
  ]);

  const history = [...milestoneReleases.rows, ...disbursements.rows, ...achievementGrants.rows]
    .map((row) => ({
      kind: row.kind,
      amount: toNumber(row.amount),
      label: row.label,
      earnedAtIso: row.earned_at ? row.earned_at.toISOString() : new Date(0).toISOString(),
    }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => (a.earnedAtIso < b.earnedAtIso ? 1 : -1));

  const totalEarned = roundCurrency(history.reduce((sum, entry) => sum + entry.amount, 0));

  return {
    availableBalance: wallet.availableBalance,
    walletEscrowBalance: wallet.walletEscrowBalance,
    levelUpEscrowedBalance: wallet.levelUpEscrowedBalance,
    totalEarned,
    history,
  };
}

export async function listEnrollmentMilestones(enrollmentId: string) {
  const milestones = await queryDb<{
    milestone_id: string;
    name: string;
    percent_release: string;
    required_task: string;
    validation_status: string | null;
    release_status: string;
    held_amount: string;
  }>(
    `SELECT
      m.id::text AS milestone_id,
      m.name,
      m.percent_release::text,
      m.required_task,
      v.status AS validation_status,
      e.release_status,
      e.held_amount::text
     FROM level_up_enrollment_milestone_escrows e
     JOIN level_up_milestones m ON m.id = e.milestone_id
     LEFT JOIN level_up_milestone_validations v ON v.enrollment_id = e.enrollment_id AND v.milestone_id = e.milestone_id
     WHERE e.enrollment_id = $1::uuid
     ORDER BY m.sequence_no ASC`,
    [enrollmentId],
  );

  return milestones.rows.map((row) => ({
    milestoneId: row.milestone_id,
    name: row.name,
    percentRelease: toNumber(row.percent_release),
    requiredTask: row.required_task,
    validationStatus: row.validation_status,
    releaseStatus: row.release_status,
    heldAmount: toNumber(row.held_amount),
  }));
}
