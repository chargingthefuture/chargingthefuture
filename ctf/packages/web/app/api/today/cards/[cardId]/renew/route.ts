import { NextResponse } from 'next/server';
import { cardsDenied, cardsFailed } from 'lib/today/cards/access';
import { requirePoster } from 'lib/today/poster';
import { readWindows, renewWindow } from 'lib/today/windows';
import { renewedUntil } from 'lib/today/lifetime';

// POST /api/today/cards/[cardId]/renew: the poster keeps their own open ask or offer on Today for 14
// more days from this tap (the one tap on the day-14 notice in Activity, or on the card). An ask with
// a deadline stays until its deadline and is not renewed. Only the poster may call it.

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ cardId: string }> };

export async function POST(request: Request, context: Context) {
  const gate = await requirePoster(request, context, 'renew');
  if (!gate.ok) return gate.response;
  try {
    const window = (await readWindows([gate.cardId])).get(gate.cardId);
    if (window?.dueIso) return cardsDenied('has_deadline', 'This ask stays on Today until its deadline, so it is not kept up longer.', 409);
    const until = renewedUntil(new Date());
    await renewWindow(gate.cardId, gate.userId, until);
    return NextResponse.json({ ok: true, shownUntilIso: until.toISOString() }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return cardsFailed('renew', error, 'The card was not kept up: the database write failed. Try again.');
  }
}
