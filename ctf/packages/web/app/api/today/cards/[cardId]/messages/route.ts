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
  readAccountId,
  readJson,
  requireCardsAccess,
} from 'lib/today/cards/access';
import { findPair, insertMessage } from 'lib/today/cards/repository';
import { readConversation } from 'lib/today/cards/conversation';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { notifySafe } from 'lib/notifications/repository';

// POST /api/today/cards/[cardId]/messages { body, private, partnerId? }: write in a card. Public
// messages are read by everybody who can read Today. A private one goes into the Just us two
// conversation with partnerId, which must be open (both agreed); the partner is told in Activity.
// Refused when the writer is restricted from contact, or, for Just us two, when either has blocked
// the other.

export const dynamic = 'force-dynamic';

const MESSAGES_PER_HOUR = 60;

type Context = { params: Promise<{ cardId: string }> };
type Input = { body: string; partnerId: string | null };

// The message, or why it cannot be taken.
function readInput(json: Record<string, unknown> | null, userId: string): Input | string {
  const body = typeof json?.body === 'string' ? json.body.trim() : '';
  if (body.length === 0 || body.length > SE_CARD_MESSAGE_MAX) return `A message is 1 to ${SE_CARD_MESSAGE_MAX} characters.`;
  if (json?.private !== true) return { body, partnerId: null };
  const partnerId = readAccountId(json.partnerId);
  if (!partnerId || partnerId === userId) return 'A Just us two message needs partnerId, the other member in the conversation.';
  return { body, partnerId };
}

async function ensurePairOpen(cardId: string, userId: string, partnerId: string): Promise<NextResponse | null> {
  const pair = await findPair(cardId, userId, partnerId);
  if (pair?.agreedAt) return null;
  return cardsDenied('pair_not_open', 'Just us two is not open with this member on this card: it opens once you both agree.', 409);
}

async function tellPartner(userId: string, partnerId: string) {
  const names = await resolveUsernames([userId]);
  await notifySafe({
    userId: partnerId,
    sourcePlugin: 'today',
    notificationType: 'today.card.pair_message',
    category: 'community',
    summary: `New message from ${names.get(userId) ?? 'a member'}, just you two, on a card in Today.`,
    linkPath: '/',
  });
}

async function write(cardId: string, userId: string, input: Input): Promise<NextResponse | null> {
  const refused = await ensureCanContact(userId, input.partnerId);
  if (refused) return refused;
  if (input.partnerId) {
    const closed = await ensurePairOpen(cardId, userId, input.partnerId);
    if (closed) return closed;
  }
  await insertMessage(cardId, userId, input.body, input.partnerId);
  if (input.partnerId) await tellPartner(userId, input.partnerId);
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
  const limited = rateLimited(`today-cards:message:${userId}`, MESSAGES_PER_HOUR, 3_600_000, 'Too many messages this hour. Try again later.');
  if (limited) return limited;
  const input = readInput(await readJson(request), userId);
  if (typeof input === 'string') return cardsDenied('invalid_message', input, 400);
  try {
    const refused = await write(cardId, userId, input);
    if (refused) return refused;
    const conversation = await readConversation(userId, cardId);
    return NextResponse.json({ ok: true, conversation }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return cardsFailed('send_message', error, 'The message was not sent: the database write failed. Try again.');
  }
}
