import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicReadAccess } from '../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { isValidComicAnswerRating, rateComicAnswer } from 'lib/comic/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RateBody = {
  rating?: string;
};

type RouteParams = {
  params: Promise<{
    turnId: string;
  }>;
};

// Rate an answered AI Assistant turn (helpful / not_helpful / flagged). Member-or-admin gated; the
// repository additionally enforces that the turn is one the caller is allowed to rate (their own
// conversation, review resolved as approved/corrected). Mirrors the feed answer-rating route.
export async function POST(request: Request, { params }: RouteParams) {
  const gate = await requireComicReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: RateBody;
  try {
    body = (await request.json()) as RateBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  if (!body.rating || !isValidComicAnswerRating(body.rating)) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid answer rating value.' },
      { status: 400 },
    );
  }

  const { turnId } = await params;

  try {
    const result = await rateComicAnswer(gate.auth.userId, turnId, body.rating);

    logComicAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.answer.rate',
      status: 'allow',
      reason: 'answer_rating_allowed',
      targetType: 'comic_turn',
      targetId: turnId,
      result: 'success',
      errorCategory: null,
      metadata: {
        rating: result.rating,
      },
    });

    return NextResponse.json({ ok: true, turnId: result.turnId, rating: result.rating, ratedAt: result.ratedAtIso }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'answers_turnid_rate' });
    if (error instanceof Error && error.message === 'answer_not_found') {
      return NextResponse.json(
        { ok: false, code: COMIC_ERROR_CODE.answerNotFound, message: 'AI Assistant answer not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to rate AI Assistant answer.' },
      { status: 503 },
    );
  }
}
