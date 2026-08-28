import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { relabelQuestionCategory, isValidFeedQuestionCategory } from 'lib/feed/repository';
import { recordFeedAdminAudit } from 'lib/feed/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function PATCH(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: { category?: unknown };
  try {
    body = (await request.json()) as { category?: unknown };
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  if (typeof body.category !== 'string' || !isValidFeedQuestionCategory(body.category)) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid category value.' },
      { status: 400 },
    );
  }

  const { questionId } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(questionId)) {
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
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.notFound, message: `Question not found: ${failureReason(error)}` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to relabel question.' },
      { status: 503 },
    );
  }
}
