import { NextResponse } from 'next/server';
import { z } from 'zod';
import { insertSkillUpAudit, openDispute } from 'lib/skill-up/repository';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const disputeSchema = z.object({
  enrollmentId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  attachments: z.array(z.string().url()).optional(),
  idempotencyKey: z.string().min(3),
});

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSkillUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = disputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'skill_up_invalid_payload', message: 'Invalid dispute payload.', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const dispute = await openDispute({
      actorId: gate.auth.userId,
      isAdmin: gate.auth.isAdmin,
      ...parsed.data,
    });

    await insertSkillUpAudit({
      actorId: gate.auth.userId,
      command: 'skill-up.dispute.open',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'dispute',
      targetId: dispute.disputeId,
      metadata: { enrollmentId: parsed.data.enrollmentId, milestoneId: parsed.data.milestoneId ?? null },
    });

    return NextResponse.json({ ok: true, disputeId: dispute.disputeId }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'disputes' });
    return skillUpErrorResponse(error, 'Open dispute unavailable.');
  }
}
