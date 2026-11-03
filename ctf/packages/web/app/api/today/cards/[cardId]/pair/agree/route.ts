import { NextResponse } from 'next/server';
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
import { agreePairRequest } from 'lib/today/cards/repository';
import { readConversation } from 'lib/today/cards/conversation';

// POST /api/today/cards/[cardId]/pair/agree { partnerId }: agree to talk just you two with the
// member who asked, on this card. Only the member who was asked can agree. Refused when either has
// blocked the other or either is restricted from contact.

export const dynamic = 'force-dynamic';

const AGREES_PER_HOUR = 30;

type Context = { params: Promise<{ cardId: string }> };

// Null once agreed; otherwise the refusal.
async function agree(cardId: string, userId: string, partnerId: string): Promise<NextResponse | null> {
  const refused = await ensureCanContact(userId, partnerId);
  if (refused) return refused;
  if (await agreePairRequest(cardId, userId, partnerId)) return null;
  return cardsDenied('nothing_to_agree', 'There is no request from this member on this card waiting for you to agree.', 404);
}

export async function POST(request: Request, context: Context) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireCardsAccess();
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;
  const cardId = await cardIdFrom(context);
  if (!cardId) return invalidCard();
  const limited = rateLimited(`today-cards:agree:${userId}`, AGREES_PER_HOUR, 3_600_000, 'Too many agreements this hour. Try again later.');
  if (limited) return limited;
  const partnerId = readAccountId((await readJson(request))?.partnerId);
  if (!partnerId || partnerId === userId) return cardsDenied('invalid_partner', 'Send partnerId, the member who asked you.', 400);
  try {
    const refused = await agree(cardId, userId, partnerId);
    if (refused) return refused;
    const conversation = await readConversation(userId, cardId);
    return NextResponse.json({ ok: true, conversation }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return cardsFailed('agree_pair', error, 'The agreement was not saved: the database write failed. Try again.');
  }
}
