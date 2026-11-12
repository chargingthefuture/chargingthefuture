import { NextResponse } from 'next/server';
import { cardsDenied, cardsFailed, readJson } from 'lib/today/cards/access';
import { requirePoster } from 'lib/today/poster';
import { closableSource, closeTodayItem } from 'lib/today/items';
import { recordOutcome } from 'lib/today/windows';
import { grantDailyCreditOnTodayClose } from 'lib/today/daily-credit/grant';

// POST /api/today/cards/[cardId]/close { outcome: 'done' | 'not_done' }: the poster closes their own
// open ask from Today. The ask is closed where it lives (a goal reached or withdrawn, a request closed
// or canceled, a ride request canceled), and the outcome is kept on today_card_windows so needs that
// went unmet can be counted. Only the poster may call it. Closed as done on the day's credit card, the
// first member who answered "I can help" receives its 1 ServiceCredit (lib/today/daily-credit/grant.ts).

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ cardId: string }> };

function readOutcome(body: Record<string, unknown> | null): 'done' | 'not_done' | null {
  return body?.outcome === 'done' || body?.outcome === 'not_done' ? body.outcome : null;
}

export async function POST(request: Request, context: Context) {
  const gate = await requirePoster(request, context, 'close');
  if (!gate.ok) return gate.response;
  if (!closableSource(gate.cardId)) return cardsDenied('not_an_ask', 'Only an ask is closed from Today; an offer is changed where it was posted.', 400);
  const outcome = readOutcome(await readJson(request));
  if (!outcome) return cardsDenied('invalid_outcome', "Send outcome: 'done' or 'not_done'.", 400);
  try {
    const closed = await closeTodayItem(gate.cardId, gate.userId, outcome === 'done');
    if (!closed) return cardsDenied('not_open', 'This is no longer open where it was posted, so it was not closed.', 409);
    await recordOutcome(gate.cardId, gate.userId, outcome);
    if (outcome === 'done') await grantDailyCreditOnTodayClose(gate.cardId, gate.userId);
    return NextResponse.json({ ok: true, outcome }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return cardsFailed('close', error, 'The ask was not closed: the database write failed. Try again.');
  }
}
