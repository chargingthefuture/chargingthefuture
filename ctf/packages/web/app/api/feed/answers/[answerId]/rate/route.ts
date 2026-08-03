import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { isValidAnswerRating, rateFeedAnswer } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RateBody = {
  rating?: string;
};

type RouteParams = {
  params: Promise<{
    answerId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const gate = await requireFeedReadAccess();
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
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  if (!body.rating || !isValidAnswerRating(body.rating)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid answer rating value.' },
      { status: 400 },
    );
  }

  const { answerId } = await params;

  try {
    const result = await rateFeedAnswer(gate.auth.userId, answerId, body.rating);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.question.answer.rate',
      status: 'allow',
      reason: 'answer_rating_allowed',
      targetType: 'feed_answer',
      targetId: answerId,
      result: 'success',
      errorCategory: null,
      metadata: {
        rating: body.rating,
      },
    });

    return NextResponse.json({ ok: true, answerId: result.answerId, ratedAt: result.ratedAtIso }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'answers_answerid_rate' });
    if (error instanceof Error && error.message === 'answer_not_found') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.answerNotFound, message: 'Answer not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to rate answer.' },
      { status: 503 },
    );
  }
}
