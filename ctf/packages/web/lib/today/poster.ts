import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from '../auth/server-authz';
import { cardIdFrom, cardsDenied, cardsFailed, ensureMutationCsrf, invalidCard, rateLimited } from './cards/access';
import { readTodayItem, type TodayItem } from './items';

// What the close and renew routes share: the poster alone may change how long their own ask or offer
// stays on Today, and only while it is still open where it lives. A member may always close or keep up
// their own ask or offer, whatever their Unlock standing, after day 14 too (owner decision,
// 2026-11-10): 'signed_in', with account restrictions still applied, under "3.1 open sign-up use".

const CHANGES_PER_MINUTE = 20;

export type PosterGate = { ok: true; userId: string; cardId: string; item: TodayItem } | { ok: false; response: NextResponse };

type Context = { params: Promise<{ cardId: string }> };

async function readItem(cardId: string, userId: string): Promise<TodayItem | null | NextResponse> {
  try {
    return await readTodayItem(cardId, userId);
  } catch (error) {
    return cardsFailed('poster_read_item', error, 'The item behind this card could not be read: the database read failed. Try again.');
  }
}

export async function requirePoster(request: Request, context: Context, op: 'close' | 'renew'): Promise<PosterGate> {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return { ok: false, response: csrf };
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) return { ok: false, response: NextResponse.json(decision, { status: decision.status }) };
  const userId = decision.userId;
  const cardId = await cardIdFrom(context);
  if (!cardId) return { ok: false, response: invalidCard() };
  const limited = rateLimited(`today-cards:${op}:${userId}`, CHANGES_PER_MINUTE, 60_000, 'Too many changes in a minute. Try again shortly.');
  if (limited) return { ok: false, response: limited };
  const item = await readItem(cardId, userId);
  if (item instanceof NextResponse) return { ok: false, response: item };
  if (!item || item.ownerUserId !== userId) {
    return { ok: false, response: cardsDenied('not_yours', 'Only the member who posted this ask or offer can change how long it stays on Today.', 404) };
  }
  if (!item.open) {
    return { ok: false, response: cardsDenied('not_open', 'This is no longer open where it was posted, so it is not on Today.', 409) };
  }
  return { ok: true, userId, cardId, item };
}
