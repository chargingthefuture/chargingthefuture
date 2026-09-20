import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { readDailyExchangeActivity } from 'lib/engagement/exchange-activity';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// How many members traded with each other on a day, read by the Daily exchange screen.
//
// Admin-only and read-only. Counts only: no name, no address, no amount, nothing about who traded
// with whom — the answer is a number of people per day and nothing else.
export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }
  if (!decision.isAdmin) {
    return NextResponse.json(
      { ok: false, code: 'forbidden', message: 'This reading is admin-only.' },
      { status: 403 },
    );
  }

  try {
    const reading = await readDailyExchangeActivity(30);
    return NextResponse.json({ reading }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'engagement', op: 'admin_daily_exchange' });
    return NextResponse.json(
      {
        ok: false,
        code: 'persistence_unavailable',
        message: `Unable to read the daily exchange count: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
