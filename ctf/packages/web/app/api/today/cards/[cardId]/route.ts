import { NextResponse } from 'next/server';
import { cardIdFrom, cardsFailed, invalidCard, requireCardsAccess } from 'lib/today/cards/access';
import { readConversation } from 'lib/today/cards/conversation';

// GET /api/today/cards/[cardId]: what a Today card's sheet shows the viewer. Who answered and how,
// the public conversation, and the viewer's own Just us two conversations on the card with where
// each stands. Nobody either side blocked and nobody the viewer muted appears.

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ cardId: string }> };

export async function GET(_request: Request, context: Context) {
  const gate = await requireCardsAccess('read');
  if (!gate.allowed) return gate.response;
  const cardId = await cardIdFrom(context);
  if (!cardId) return invalidCard();
  try {
    const conversation = await readConversation(gate.auth.userId, cardId);
    return NextResponse.json({ ok: true, conversation }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return cardsFailed('read_conversation', error, 'The conversation could not be read: the database read failed.');
  }
}
