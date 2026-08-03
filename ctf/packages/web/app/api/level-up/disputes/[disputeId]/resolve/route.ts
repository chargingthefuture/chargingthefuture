import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDisputeCohortId, insertLevelUpAudit, isTrainerForCohort, resolveDispute } from 'lib/level-up/repository';
import { ensureMutationCsrf, levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteProps = {
  params: Promise<{ disputeId: string }>;
};

const adjustmentSchema = z.object({
  sourceUserId: z.string().min(1),
  destinationUserId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(1),
});

const resolveSchema = z.object({
  resolutionComment: z.string().min(1),
  attachments: z.array(z.string().url()).optional(),
  adjustment: adjustmentSchema.optional(),
  idempotencyKey: z.string().min(3),
});

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const resolvedParams = await params;

  // dispute.resolve is permitted for admins and for the trainer assigned to the dispute's
  // cohort (per the access policy contract's trainerAssignmentOrAdmin rule).
  if (!gate.auth.isAdmin) {
    const cohortId = await getDisputeCohortId(resolvedParams.disputeId);
    const trainerForScope = cohortId ? await isTrainerForCohort(gate.auth.userId, cohortId) : false;
    if (!trainerForScope) {
      return NextResponse.json({ ok: false, code: 'level_up_forbidden', message: 'Assigned trainer or admin role required to resolve disputes.' }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'level_up_invalid_payload', message: 'Invalid resolve payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const resolution = await resolveDispute({
      actorId: gate.auth.userId,
      disputeId: resolvedParams.disputeId,
      resolutionComment: parsed.data.resolutionComment,
      attachments: parsed.data.attachments,
      adjustment: parsed.data.adjustment,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    await insertLevelUpAudit({
      actorId: gate.auth.userId,
      command: 'level-up.dispute.resolve',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'dispute',
      targetId: resolvedParams.disputeId,
      metadata: {
        adjustmentId: resolution.adjustmentId,
        transferId: resolution.transferId,
      },
    });

    return NextResponse.json({ ok: true, resolution }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'disputes_disputeid_resolve' });
    return levelUpErrorResponse(error, 'Resolve dispute unavailable.');
  }
}
