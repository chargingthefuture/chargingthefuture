import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedReadAccess } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { logFeedAudit } from 'lib/feed/audit';
import { generateFeedQuestionAnswer } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';



export async function POST(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { questionId } = await params;

  try {
    const answer = await generateFeedQuestionAnswer(gate.auth.userId, questionId);
    logFeedAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.question.answer.generate',
      status: 'allow',
      reason: 'llm_generation_allowed',
      targetType: 'feed_question',
      targetId: questionId,
      result: 'success',
      errorCategory: null,
      metadata: {
        answerId: answer.id,
        modelId: answer.modelId,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        answerId: answer.id,
        body: answer.body,
        sources: answer.sources,
        confidence: answer.confidence,
        modelId: answer.modelId,
        generatedAt: answer.createdAtIso,
      },
      { status: 201 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';

    if (code === 'question_not_found') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.notFound, message: 'Question not found.' },
        { status: 404 },
      );
    }

    if (code === 'llm_consent_required') {
      return NextResponse.json(
        { ok: false, code: FEED_ERROR_CODE.consentRequired, message: 'LLM processing consent is required before generating an answer.' },
        { status: 403 },
      );
    }

    reportError(error, { area: 'feed', op: 'answer_question', extra: { userId: gate.auth.userId, questionId } });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.llmUnavailable, message: 'Unable to generate an assisted answer right now.' },
      { status: 503 },
    );
  }
}
