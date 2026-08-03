import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedReadAccess } from '../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { createFeedQuestion, validateFeedQuestionInput } from 'lib/feed/repository';
import type { FeedQuestionInput } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type QuestionBody = Partial<FeedQuestionInput>;

function parseBody(body: QuestionBody): FeedQuestionInput {
  return {
    body: typeof body.body === 'string' ? body.body : '',
    category: body.category,
    location: body.location,
    consentGranted: body.consentGranted === true,
  };
}

export async function POST(request: Request) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: QuestionBody;
  try {
    body = (await request.json()) as QuestionBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!validateFeedQuestionInput(input)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid question payload.' },
      { status: 400 },
    );
  }

  if (!input.consentGranted) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.consentRequired, message: 'LLM processing consent is required before submitting a question.' },
      { status: 403 },
    );
  }

  try {
    const result = await createFeedQuestion(gate.auth.userId, input);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.question.submit',
      status: 'allow',
      reason: 'question_submission_allowed',
      targetType: 'feed_question',
      targetId: result.questionId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, questionId: result.questionId, createdAt: result.createdAtIso, status: 'submitted' }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';
    if (code === 'rate_limit_exceeded') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.rateLimitExceeded, message: 'Question submission rate limit exceeded.' },
        { status: 429 },
      );
    }

    if (code === 'content_policy_violation') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.moderationRejected, message: 'Question blocked by content moderation.' },
        { status: 422 },
      );
    }

    reportError(error, { area: 'feed', op: 'questions' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to submit question.' },
      { status: 503 },
    );
  }
}
