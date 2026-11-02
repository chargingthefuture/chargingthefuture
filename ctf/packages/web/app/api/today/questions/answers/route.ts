import { NextResponse } from 'next/server';
import { seNextQuestion, seQuestionById, seQuestionsOut, SE_QUESTIONS, type SeQuestion } from '@ctf/shared';
import { ensureMutationCsrf, requireQuestionsAccess } from 'lib/questions/_lib';
import { listAnswers, saveAnswer } from 'lib/questions/repository';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';

// POST /api/today/questions/answers { questionId, choice }: answer one of the questions that are out.
// The first answer stands. Answers with the next question to show, or null when all out are answered.

export const dynamic = 'force-dynamic';

const ANSWERS_PER_MINUTE = 30;

function readBody(body: unknown): { questionId: string; choice: number } | null {
  const value = body as { questionId?: unknown; choice?: unknown } | null;
  if (typeof value?.questionId !== 'string' || typeof value.choice !== 'number' || !Number.isInteger(value.choice)) return null;
  return { questionId: value.questionId, choice: value.choice };
}

// The question being answered, or why the answer cannot be taken.
function checkAnswer(input: { questionId: string; choice: number } | null, day: string): SeQuestion | string {
  if (!input) return "Send questionId (text) and choice (the answer's position: 0, 1, 2 or 3).";
  const question = seQuestionById(input.questionId);
  if (!question || !SE_QUESTIONS.slice(0, seQuestionsOut(day)).includes(question)) return 'That question is not out yet.';
  if (input.choice < 0 || input.choice >= question.choices.length) return 'That answer is not one of the choices.';
  return question;
}

function invalid(message: string) {
  return NextResponse.json({ ok: false, code: 'invalid_answer', message }, { status: 400 });
}

export async function POST(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireQuestionsAccess();
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;

  const limit = checkRateLimit(`questions:answer:${userId}`, ANSWERS_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many answers in a minute. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const input = readBody(await request.json().catch(() => null));
  const day = new Date().toISOString().slice(0, 10);
  const question = checkAnswer(input, day);
  if (typeof question === 'string' || !input) return invalid(typeof question === 'string' ? question : 'Missing answer.');

  try {
    const saved = await saveAnswer(userId, question.id, input.choice);
    const answered = new Set((await listAnswers(userId)).keys());
    const next = seNextQuestion(day, answered);
    return NextResponse.json({ ok: true, saved, next: next?.id ?? null }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'questions', op: 'answer' });
    return NextResponse.json(
      { ok: false, code: 'questions_unavailable', message: 'The answer was not saved: the database write failed. Try again.' },
      { status: 503 },
    );
  }
}
