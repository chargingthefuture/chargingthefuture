import { NextResponse } from 'next/server';
import { seReadTodayDay } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { buildToday } from 'lib/today/build';
import { reportError } from 'lib/observability/report';

// GET /api/today: everything the 3.1 Today screen draws, in one answer. Open to every signed-in
// member, approved or not, and after the 14 days (SOCIAL_REDESIGN_3_1_PLAN, Access: reading stays
// open). A source that fails is left out and named in `unavailable`; only a failure of the entire
// read answers 503. `?day=YYYY-MM-DD&dayStart=<ISO>` is the member's own day and when it began, so
// the five stories, the puzzle, 21 Questions and the day's own cards turn at their midnight, and a
// card they marked done leaves Today from their next day (their marks are applied from
// today_card_marks); without them, or with a day more than one off, the UTC day is used.

export const dynamic = 'force-dynamic';

// The member's own day from the query (seReadTodayDay): `day` and `dayStart` as the screen sends them.
function readDay(request: Request, now: Date) {
  const params = new URL(request.url).searchParams;
  return seReadTodayDay({ day: params.get('day'), dayStart: params.get('dayStart') }, now);
}

export async function GET(request: Request) {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  try {
    const now = new Date();
    const today = await buildToday({ userId: decision.userId, isAdmin: decision.isAdmin }, now, readDay(request, now));
    return NextResponse.json({ ok: true, today }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'today', op: 'build' });
    return NextResponse.json(
      { ok: false, code: 'TODAY_UNAVAILABLE', message: 'Could not read Today: building the list of cards failed.' },
      { status: 503 },
    );
  }
}
