import { NextResponse } from 'next/server';
import { z } from 'zod';
import { leaveCohort } from 'lib/skill-up/repository';
import { ensureMutationCsrf, skillUpErrorResponse, requireSkillUpReadAccess } from 'lib/skill-up/_lib';
import { reportError } from 'lib/observability/report';
import { withReason } from 'lib/errors/failure';

type RouteProps = {
  params: Promise<{ enrollmentId: string }>;
};

const bodySchema = z.object({ idempotencyKey: z.string().min(3) });

// A member leaves a cohort and gets back every credit still held for it.
//
// Until this existed there was no way out of an enrollment: escrow left 'held' only when a trainer
// validated a milestone, and there was no drop route at all. With a real deposit that would strand
// the credits of anyone who stalls, or whose cohort never gets a trainer, so it ships alongside the
// deposit rather than after it.
//
// Scoped to the caller's own enrollment inside the repository — it takes no user id from the
// request, so an admin calling it still only leaves their own.
export async function POST(request: Request, { params }: RouteProps) {
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
    return NextResponse.json(
      { ok: false, code: 'skill_up_invalid_json', message: withReason('Body must be JSON.', error) },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: 'skill_up_invalid_payload', message: 'An idempotencyKey is required so a repeated request cannot refund twice.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { enrollmentId } = await params;

  try {
    const outcome = await leaveCohort({
      actorId: gate.auth.userId,
      enrollmentId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    if (outcome.status === 'not_found') {
      return NextResponse.json({ ok: false, code: 'skill_up_not_found', message: 'No enrollment with that id.' }, { status: 404 });
    }
    if (outcome.status === 'not_yours') {
      return NextResponse.json({ ok: false, code: 'skill_up_forbidden', message: 'You can only leave your own enrollment.' }, { status: 403 });
    }
    if (outcome.status === 'invalid_state') {
      return NextResponse.json(
        { ok: false, code: 'skill_up_invalid_state', message: 'This enrollment is already finished or left, so there is nothing held to return.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, enrollmentId, refundedCredits: outcome.refundedCredits }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skill-up', op: 'enrollment_leave' });
    return skillUpErrorResponse(error, 'Leaving the cohort is unavailable.');
  }
}
