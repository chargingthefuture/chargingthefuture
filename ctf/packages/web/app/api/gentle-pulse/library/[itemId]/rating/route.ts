import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireGentlePulseWriteAccess } from 'lib/gentle-pulse/_lib';
import { upsertRating } from 'lib/gentle-pulse/repository';
import { logGentlePulseAudit } from 'lib/gentle-pulse/audit';

const COMMAND = 'gentle-pulse.rating.upsert';

type ItemParams = {
  params: Promise<{ itemId: string }>;
};

type RatingBody = {
  rating?: number;
};

export async function PUT(request: Request, context: ItemParams) {
  const { itemId } = await context.params;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    logGentlePulseAudit({
      actorId: null,
      command: COMMAND,
      status: 'deny',
      reason: 'csrf_denied',
      result: 'failure',
      errorCategory: 'csrf',
      meditationId: itemId,
    });
    return csrfDeny;
  }

  const gate = await requireGentlePulseWriteAccess();
  if (!gate.allowed) {
    logGentlePulseAudit({
      actorId: null,
      command: COMMAND,
      status: 'deny',
      reason: 'access_denied',
      result: 'failure',
      errorCategory: 'authz',
      meditationId: itemId,
    });
    return gate.response;
  }

  let body: RatingBody;
  try {
    body = (await request.json()) as RatingBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'gentle_pulse_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body.rating !== 'number') {
    return NextResponse.json({ ok: false, code: 'gentle_pulse_invalid_payload', message: 'rating is required.' }, { status: 400 });
  }

  try {
    const { averageRating, ratingCount } = await upsertRating({ userId: gate.auth.userId, itemId, rating: body.rating });
    logGentlePulseAudit({
      actorId: gate.auth.userId,
      command: COMMAND,
      status: 'allow',
      reason: 'policy_pass',
      result: 'success',
      meditationId: itemId,
    });
    return NextResponse.json({ ok: true, meditationId: itemId, averageRating, ratingCount }, { status: 200 });
  } catch {
    logGentlePulseAudit({
      actorId: gate.auth.userId,
      command: COMMAND,
      status: 'deny',
      reason: 'invalid_rating_value',
      result: 'failure',
      errorCategory: 'validation',
      meditationId: itemId,
    });
    return NextResponse.json({ ok: false, code: 'gentle_pulse_invalid_payload', message: 'Invalid rating payload.' }, { status: 400 });
  }
}
