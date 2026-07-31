import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCohort, insertLevelUpAudit, listCohorts } from 'lib/level-up/repository';
import { ensureMutationCsrf, levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

const querySchema = z.object({
  track: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  seatsAvailable: z.enum(['0', '1']).optional(),
});

const curriculumItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

const milestoneSchema = z.object({
  name: z.string().min(1),
  percentRelease: z.number().positive().max(100),
  requiredTask: z.string().min(1),
});

const jsonObjectSchema = z.object({}).catchall(z.unknown());

const createCohortSchema = z.object({
  idempotencyKey: z.string().min(3),
  title: z.string().min(1),
  description: z.string().min(1),
  track: z.string().min(1),
  seats: z.number().int().positive(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  requiredCredits: z.number().min(0),
  materialsCost: z.number().min(0).optional(),
  deviceSupport: z.boolean().optional(),
  status: z.enum(['draft', 'open', 'active', 'completed', 'canceled']).optional(),
  allowNoDeposit: z.boolean().optional(),
  trainerSplitPercent: z.number().min(0).max(100).optional(),
  completionBonusCredits: z.number().min(0).optional(),
  stipendMode: z.enum(['none', 'scheduled', 'milestone']).optional(),
  stipendAmountPerPayout: z.number().min(0).optional(),
  stipendIntervalDays: z.number().int().positive().nullable().optional(),
  micrograntMode: z.enum(['none', 'cohort_pool', 'separate_grant']).optional(),
  micrograntAmount: z.number().min(0).optional(),
  refundPolicyJson: jsonObjectSchema.optional(),
  payoutPolicyJson: jsonObjectSchema.optional(),
  policyJson: jsonObjectSchema.optional(),
  curriculumItems: z.array(curriculumItemSchema).optional(),
  milestones: z.array(milestoneSchema).optional(),
});

export async function GET(request: Request) {
  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    track: url.searchParams.get('track') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    startDate: url.searchParams.get('startDate') ?? undefined,
    seatsAvailable: url.searchParams.get('seatsAvailable') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_payload', message: 'Invalid query filters.', issues: parsed.error.issues }, { status: 400 });
  }

  const cohorts = await listCohorts({
    track: parsed.data.track,
    status: parsed.data.status,
    startDate: parsed.data.startDate,
    seatsAvailableOnly: parsed.data.seatsAvailable === '1',
  });

  return NextResponse.json({ ok: true, cohorts });
}

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  // cohort.create is permitted for admins and trainers (per the access policy contract).
  if (!gate.auth.isAdmin && gate.auth.role !== 'trainer') {
    return NextResponse.json({ ok: false, code: 'level_up_forbidden', message: 'Trainer or admin role required to create cohorts.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = createCohortSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_payload', message: 'Invalid create cohort payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const created = await createCohort({
      actorId: gate.auth.userId,
      ...parsed.data,
    });

    await insertLevelUpAudit({
      actorId: gate.auth.userId,
      command: 'level-up.cohort.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'cohort',
      targetId: created.cohortId,
      metadata: { track: parsed.data.track, seats: parsed.data.seats },
    });

    return NextResponse.json({ ok: true, cohortId: created.cohortId }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'cohorts' });
    return levelUpErrorResponse(error, 'Create cohort unavailable.');
  }
}
