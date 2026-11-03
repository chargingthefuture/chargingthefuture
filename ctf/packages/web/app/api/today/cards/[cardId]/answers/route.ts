import { NextResponse } from 'next/server';
import { SE_CARD_ANSWER_KINDS, type SeCardAnswerKind } from '@ctf/shared';
import {
  cardIdFrom,
  cardsDenied,
  cardsFailed,
  ensureCanContact,
  ensureMutationCsrf,
  invalidCard,
  rateLimited,
  readJson,
  requireCardsAccess,
} from 'lib/today/cards/access';
import { saveAnswer } from 'lib/today/cards/repository';
import { readConversation } from 'lib/today/cards/conversation';

// POST /api/today/cards/[cardId]/answers { kind }: answer a card ("help", "know-someone", "want" or
// "helped-me"). One answer per member per kind per card; answering again changes nothing. Answers
// with the card's conversation as the sheet now shows it.

export const dynamic = 'force-dynamic';

const ANSWERS_PER_MINUTE = 30;

type Context = { params: Promise<{ cardId: string }> };

function readKind(body: Record<string, unknown> | null): SeCardAnswerKind | null {
  const kind = body?.kind;
  return typeof kind === 'string' && (SE_CARD_ANSWER_KINDS as readonly string[]).includes(kind) ? (kind as SeCardAnswerKind) : null;
}

export async function POST(request: Request, context: Context) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireCardsAccess('write');
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;
  const cardId = await cardIdFrom(context);
  if (!cardId) return invalidCard();
  const limited = rateLimited(`today-cards:answer:${userId}`, ANSWERS_PER_MINUTE, 60_000, 'Too many answers in a minute. Try again shortly.');
  if (limited) return limited;
  const kind = readKind(await readJson(request));
  if (!kind) return cardsDenied('invalid_answer', `Send kind: one of ${SE_CARD_ANSWER_KINDS.join(', ')}.`, 400);
  try {
    const restricted = await ensureCanContact(userId, null);
    if (restricted) return restricted;
    const saved = await saveAnswer(userId, cardId, kind);
    const conversation = await readConversation(userId, cardId);
    return NextResponse.json({ ok: true, saved, conversation }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return cardsFailed('answer', error, 'The answer was not saved: the database write failed. Try again.');
  }
}
