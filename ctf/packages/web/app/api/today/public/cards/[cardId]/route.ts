import { NextResponse } from 'next/server';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { readCardId } from 'lib/today/cards/ids';
import { guestOpens, readGuestConversation } from 'lib/today/cards/public-read';

// GET /api/today/public/cards/[cardId]: a card opened on signed-out Today. No sign-in, limited per
// address. A story's post comments (public on the blog) or a sample card's sample conversation;
// never a Just us two message, and no other card (lib/today/cards/public-read.ts).

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ cardId: string }> };

export async function GET(request: Request, context: Context) {
  const limited = enforcePublicReadRateLimit(request, 'today-public-card');
  if (limited) return limited;
  const cardId = readCardId((await context.params).cardId);
  if (!cardId || !guestOpens(cardId)) {
    return NextResponse.json(
      { ok: false, code: 'CARD_NOT_OPEN', message: 'Only a story or a sample ask or offer opens without signing in.' },
      { status: 404 },
    );
  }
  try {
    const conversation = await readGuestConversation(cardId);
    return NextResponse.json({ ok: true, conversation }, { headers: { 'cache-control': 'public, max-age=30, s-maxage=60' } });
  } catch (error) {
    reportError(error, { area: 'today', op: 'public_card' });
    return NextResponse.json(
      { ok: false, code: 'CARD_UNAVAILABLE', message: `Could not read the conversation: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
