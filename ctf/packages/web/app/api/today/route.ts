import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { buildToday } from 'lib/today/build';
import { reportError } from 'lib/observability/report';

// GET /api/today: everything the 3.1 Today screen draws, in one answer. Open to every signed-in
// member, approved or not, and after the 14 days (SOCIAL_REDESIGN_3_1_PLAN, Access: reading stays
// open). A source that fails is left out and named in `unavailable`; only a failure of the entire
// read answers 503. `?dayStart=<ISO>` is the start of the member's own day, so a card they marked
// done leaves Today from their next day (their marks are applied from today_card_marks); without it,
// or with a moment more than a day and a half off, the UTC day is used.

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

function readDayStart(request: Request, now: Date): string | undefined {
  const value = new URL(request.url).searchParams.get('dayStart');
  const at = value ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(at) || at > now.getTime() + DAY_MS / 24 || at < now.getTime() - 1.5 * DAY_MS) return undefined;
  return new Date(at).toISOString();
}

export async function GET(request: Request) {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  try {
    const now = new Date();
    const today = await buildToday({ userId: decision.userId, isAdmin: decision.isAdmin }, now, readDayStart(request, now));
    return NextResponse.json({ ok: true, today }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'today', op: 'build' });
    return NextResponse.json(
      { ok: false, code: 'TODAY_UNAVAILABLE', message: 'Could not read Today: building the list of cards failed.' },
      { status: 503 },
    );
  }
}
