import { NextResponse } from 'next/server';
import { recordFeedAdminFailure, requireFeedAdminMutation } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { relabelQuestionCategory, isValidFeedQuestionCategory } from 'lib/feed/repository';
import { recordFeedAdminAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function PATCH(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const audit = { command: 'feed.question.category.relabel', targetType: 'feed_question', targetId: questionId };
  const gate = await requireFeedAdminMutation(request, audit);
  if (!gate.allowed) {
    return gate.response;
  }

  let body: { category?: unknown };
  try {
    body = (await request.json()) as { category?: unknown };
  } catch (error) {
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'invalid_payload', errorCategory: 'invalid_payload' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  if (typeof body.category !== 'string' || !isValidFeedQuestionCategory(body.category)) {
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'invalid_payload', errorCategory: 'invalid_payload' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid category value.' },
      { status: 400 },
    );
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(questionId)) {
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'invalid_payload', errorCategory: 'invalid_payload' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid question ID.' },
      { status: 400 },
    );
  }

  try {
    const question = await relabelQuestionCategory(gate.auth.userId, questionId, body.category);
    await recordFeedAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.question.category.relabel',
      status: 'allow',
      reason: 'admin_relabel_allowed',
      targetType: 'feed_question',
      targetId: questionId,
      result: 'success',
      errorCategory: null,
      metadata: { newCategory: body.category },
    });
    return NextResponse.json({ ok: true, question }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_questions_questionid' });
    if (error instanceof Error && error.message === 'question_not_found') {
      await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'question_not_found', errorCategory: 'not_found' });
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.notFound, message: `Question not found: ${failureReason(error)}` },
        { status: 404 },
      );
    }
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'persistence_error', errorCategory: 'persistence_error' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: `Unable to relabel question: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
