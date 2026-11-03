import { NextResponse } from 'next/server';
import { SE_CARD_MESSAGE_MAX } from '@ctf/shared';
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
import { deleteOwnMessage, editOwnMessage, findOwnMessagePartner } from 'lib/today/cards/repository';
import { readConversation } from 'lib/today/cards/conversation';

// PATCH /api/today/cards/[cardId]/messages/[messageId] { body }: the author changes their own
// message, public or Just us two, and it shows Edited. Same tier and checks as writing one: refused
// when the author is restricted from contact, or, for Just us two, when either has blocked the other.
// DELETE on the same address: the author removes their own message for everyone. Signed in is
// enough, so a member whose writing is paused can still take back what they wrote.
// Either answers 404 when the message is not the caller's own on this card.

export const dynamic = 'force-dynamic';

const CHANGES_PER_HOUR = 60;

type Context = { params: Promise<{ cardId: string; messageId: string }> };

const NOT_YOURS = 'That message was not found on this card, or it is not yours: only the person who wrote a message can change or delete it.';

function readMessageId(value: string): string | null {
  return value.length > 0 && value.length <= 64 ? value : null;
}

async function target(context: Context): Promise<{ cardId: string; messageId: string } | NextResponse> {
  const cardId = await cardIdFrom(context);
  if (!cardId) return invalidCard();
  const messageId = readMessageId((await context.params).messageId);
  if (!messageId) return cardsDenied('invalid_message_id', 'That is not a message id.', 400);
  return { cardId, messageId };
}

function answer(conversation: Awaited<ReturnType<typeof readConversation>>) {
  return NextResponse.json({ ok: true, conversation }, { headers: { 'cache-control': 'private, no-store' } });
}

async function edit(cardId: string, messageId: string, userId: string, body: string): Promise<NextResponse | null> {
  const own = await findOwnMessagePartner(cardId, messageId, userId);
  if (!own.found) return cardsDenied('message_not_found', NOT_YOURS, 404);
  const refused = await ensureCanContact(userId, own.partnerId);
  if (refused) return refused;
  if (!(await editOwnMessage(cardId, messageId, userId, body))) return cardsDenied('message_not_found', NOT_YOURS, 404);
  return null;
}

export async function PATCH(request: Request, context: Context) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireCardsAccess('write');
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;
  const ids = await target(context);
  if (ids instanceof NextResponse) return ids;
  const limited = rateLimited(`today-cards:message-change:${userId}`, CHANGES_PER_HOUR, 3_600_000, 'Too many changes this hour. Try again later.');
  if (limited) return limited;
  const json = await readJson(request);
  const body = typeof json?.body === 'string' ? json.body.trim() : '';
  if (body.length === 0 || body.length > SE_CARD_MESSAGE_MAX) return cardsDenied('invalid_message', `A message is 1 to ${SE_CARD_MESSAGE_MAX} characters.`, 400);
  try {
    const refused = await edit(ids.cardId, ids.messageId, userId, body);
    if (refused) return refused;
    return answer(await readConversation(userId, ids.cardId));
  } catch (error) {
    return cardsFailed('edit_message', error, 'The change was not saved: the database write failed. Try again.');
  }
}

export async function DELETE(request: Request, context: Context) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireCardsAccess('read');
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;
  const ids = await target(context);
  if (ids instanceof NextResponse) return ids;
  const limited = rateLimited(`today-cards:message-change:${userId}`, CHANGES_PER_HOUR, 3_600_000, 'Too many changes this hour. Try again later.');
  if (limited) return limited;
  try {
    if (!(await deleteOwnMessage(ids.cardId, ids.messageId, userId))) return cardsDenied('message_not_found', NOT_YOURS, 404);
    return answer(await readConversation(userId, ids.cardId));
  } catch (error) {
    return cardsFailed('delete_message', error, 'The message was not deleted: the database write failed. Try again.');
  }
}
