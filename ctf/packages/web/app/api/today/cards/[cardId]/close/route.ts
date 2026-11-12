import { NextResponse } from 'next/server';
import { cardsDenied, cardsFailed, readJson } from 'lib/today/cards/access';
import { requirePoster } from 'lib/today/poster';
import { closableSource, closeTodayItem } from 'lib/today/items';
import { recordOutcome } from 'lib/today/windows';
import { grantDailyCreditQuietly } from 'lib/today/daily-credit/grant';
import { answeredHelpOn } from 'lib/today/daily-credit/repository';

// POST /api/today/cards/[cardId]/close { outcome: 'done' | 'not_done' }: the poster closes their own
// open ask from Today. The ask is closed where it lives (a goal reached or withdrawn, a request closed
// or canceled, a ride request canceled), and the outcome is kept on today_card_windows so needs that
// went unmet can be counted. Only the poster may call it. With 'done' the poster may name who did it,
// `helperId`, one of the members who answered "I can help" on the card; on the day's credit card that
// member receives its 1 ServiceCredit (lib/today/daily-credit/grant.ts). Without one, no credit.

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ cardId: string }> };

function readOutcome(body: Record<string, unknown> | null): 'done' | 'not_done' | null {
  return body?.outcome === 'done' || body?.outcome === 'not_done' ? body.outcome : null;
}

function readHelperId(body: Record<string, unknown> | null): string | null {
  return typeof body?.helperId === 'string' && body.helperId.length > 0 && body.helperId.length <= 200 ? body.helperId : null;
}

// The helper named with Done must have answered I can help on this card; null when none was named.
async function checkHelper(cardId: string, userId: string, helperId: string | null): Promise<NextResponse | null> {
  if (!helperId) return null;
  if (await answeredHelpOn(cardId, userId, helperId)) return null;
  return cardsDenied('not_a_helper', 'Pick somebody who answered I can help on this card.', 400);
}

export async function POST(request: Request, context: Context) {
  const gate = await requirePoster(request, context, 'close');
  if (!gate.ok) return gate.response;
  if (!closableSource(gate.cardId)) return cardsDenied('not_an_ask', 'Only an ask is closed from Today; an offer is changed where it was posted.', 400);
  const body = await readJson(request);
  const outcome = readOutcome(body);
  if (!outcome) return cardsDenied('invalid_outcome', "Send outcome: 'done' or 'not_done'.", 400);
  const helperId = outcome === 'done' ? readHelperId(body) : null;
  try {
    const badHelper = await checkHelper(gate.cardId, gate.userId, helperId);
    if (badHelper) return badHelper;
    const closed = await closeTodayItem(gate.cardId, gate.userId, outcome === 'done');
    if (!closed) return cardsDenied('not_open', 'This is no longer open where it was posted, so it was not closed.', 409);
    await recordOutcome(gate.cardId, gate.userId, outcome);
    if (helperId) await grantDailyCreditQuietly({ cardId: gate.cardId, askerUserId: gate.userId, helperUserId: helperId });
    return NextResponse.json({ ok: true, outcome }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return cardsFailed('close', error, 'The ask was not closed: the database write failed. Try again.');
  }
}
