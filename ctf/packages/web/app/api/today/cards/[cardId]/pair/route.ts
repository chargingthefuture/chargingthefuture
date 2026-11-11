import { NextResponse } from 'next/server';
import { seActivityPairRef } from '@ctf/shared';
import {
  cardIdFrom,
  cardsDenied,
  cardsFailed,
  ensureCanContact,
  ensureMutationCsrf,
  invalidCard,
  rateLimited,
  readAccountId,
  readJson,
  requireCardsAccess,
} from 'lib/today/cards/access';
import { agreePairRequest, findPair, insertPairRequest, isParticipant } from 'lib/today/cards/repository';
import { readConversation } from 'lib/today/cards/conversation';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { notifySafe } from 'lib/notifications/repository';

// POST /api/today/cards/[cardId]/pair { partnerId }: ask another member to talk just you two on
// this card. The partner must have taken part on the card (answered it, written in it, or been in a
// Just us two request on it). It opens only once they agree; they are told in Activity, where the
// notice carries the card and the asker so they can agree in place. Asking a
// member who already asked you agrees to their request. Refused when either has blocked the other
// or either is restricted from contact.

export const dynamic = 'force-dynamic';

const ASKS_PER_HOUR = 20;

type Context = { params: Promise<{ cardId: string }> };

async function tellPartner(cardId: string, userId: string, partnerId: string) {
  const names = await resolveUsernames([userId]);
  await notifySafe({
    userId: partnerId,
    sourcePlugin: 'today',
    notificationType: 'today.card.pair_request',
    category: 'community',
    summary: `${names.get(userId) ?? 'A member'} asked to talk just you two on a card in Today.`,
    linkPath: '/',
    targetRef: seActivityPairRef(cardId, userId),
  });
}

// Null when the ask went through (or agreed to theirs); otherwise the refusal.
async function ask(cardId: string, userId: string, partnerId: string): Promise<NextResponse | null> {
  const refused = await ensureCanContact(userId, partnerId);
  if (refused) return refused;
  const existing = await findPair(cardId, userId, partnerId);
  if (existing) {
    if (!existing.agreedAt && existing.requesterId === partnerId) await agreePairRequest(cardId, userId, partnerId);
    return null;
  }
  if (!(await isParticipant(cardId, partnerId))) {
    return cardsDenied('not_on_card', 'This member has not answered or written on this card, so they cannot be asked from it.', 404);
  }
  if (await insertPairRequest(cardId, userId, partnerId)) await tellPartner(cardId, userId, partnerId);
  return null;
}

export async function POST(request: Request, context: Context) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireCardsAccess('write');
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;
  const cardId = await cardIdFrom(context);
  if (!cardId) return invalidCard();
  const limited = rateLimited(`today-cards:pair:${userId}`, ASKS_PER_HOUR, 3_600_000, 'Too many requests to talk just you two this hour. Try again later.');
  if (limited) return limited;
  const partnerId = readAccountId((await readJson(request))?.partnerId);
  if (!partnerId || partnerId === userId) return cardsDenied('invalid_partner', 'Send partnerId, the other member to talk with (not yourself).', 400);
  try {
    const refused = await ask(cardId, userId, partnerId);
    if (refused) return refused;
    const conversation = await readConversation(userId, cardId);
    return NextResponse.json({ ok: true, conversation }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return cardsFailed('ask_pair', error, 'The request was not sent: the database write failed. Try again.');
  }
}
