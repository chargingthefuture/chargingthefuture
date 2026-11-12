import { NextResponse } from 'next/server';
import { seHelpedConfirmedByAdmin } from '@ctf/shared';
import { recordFeedAdminAudit } from 'lib/feed/audit';
import {
  cardIdFrom,
  cardsDenied,
  cardsFailed,
  ensureMutationCsrf,
  invalidCard,
  rateLimited,
  readJson,
  requireCardsAccess,
} from 'lib/today/cards/access';
import { isCardAuthor } from 'lib/today/cards/author';
import { confirmHelpedAnswer } from 'lib/today/cards/repository';
import { readConversation } from 'lib/today/cards/conversation';

// POST /api/today/cards/[cardId]/answers/confirm { accountId }: the card's author confirms that a
// member's "This helped me" is true (3.1.0 plan, Measures: a confirmed one counts 10 action minutes
// toward Days won, for the member who said it). Only the author: the member who posted the item, or
// an admin on a blog story, an announcement or What Works. Never one's own answer. Confirming again
// changes nothing. An admin's confirmation is recorded in feed_admin_audit_trail. Answers with the card's conversation as the sheet now shows it.

export const dynamic = 'force-dynamic';

const CONFIRMS_PER_MINUTE = 30;

type Context = { params: Promise<{ cardId: string }> };

function readAccountId(body: Record<string, unknown> | null): string | null {
  const id = body?.accountId;
  return typeof id === 'string' && id.length > 0 && id.length <= 200 ? id : null;
}

// The author check, the write and the conversation read, with the route's answer for each refusal.
async function confirm(viewer: { userId: string; isAdmin: boolean }, cardId: string, accountId: string): Promise<NextResponse> {
  if (!(await isCardAuthor(viewer, cardId))) {
    return cardsDenied('not_author', 'Only the person who wrote this card can confirm that it helped somebody.');
  }
  if (!(await confirmHelpedAnswer(cardId, accountId))) {
    return cardsDenied('no_answer', 'That member has not said this card helped them.', 404);
  }
  // An admin confirming on a card the System Architect writes is an admin action, so it is recorded.
  if (seHelpedConfirmedByAdmin(cardId)) {
    await recordFeedAdminAudit({
      actorId: viewer.userId,
      pluginId: 'feed',
      command: 'today.cards.answer.confirm_helped',
      status: 'allow',
      reason: 'card_author_admin',
      targetType: 'card_answer',
      targetId: cardId,
      result: 'success',
      errorCategory: null,
      metadata: { answeredBy: accountId },
    });
  }
  const conversation = await readConversation(viewer, cardId);
  return NextResponse.json({ ok: true, conversation }, { headers: { 'cache-control': 'private, no-store' } });
}

export async function POST(request: Request, context: Context) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireCardsAccess('write');
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;
  const cardId = await cardIdFrom(context);
  if (!cardId) return invalidCard();
  const limited = rateLimited(`today-cards:confirm:${userId}`, CONFIRMS_PER_MINUTE, 60_000, 'Too many confirmations in a minute. Try again shortly.');
  if (limited) return limited;
  const accountId = readAccountId(await readJson(request));
  if (!accountId) return cardsDenied('invalid_answer', 'Send accountId: the member whose "This helped me" you confirm.', 400);
  if (accountId === userId) return cardsDenied('own_answer', 'Your own "This helped me" is confirmed by the card\'s author, not by you.', 400);
  try {
    return await confirm(gate.auth, cardId, accountId);
  } catch (error) {
    return cardsFailed('confirm_helped', error, 'The confirmation was not saved: the database write failed. Try again.');
  }
}
