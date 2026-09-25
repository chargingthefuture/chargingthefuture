import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { readDailyExchangeActivity } from 'lib/engagement/exchange-activity';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The daily reading of the value events, for the Daily exchange screen: today and the last thirty
// days, how many members delivered value on a day against the 384 target, plus today's roster. The
// badge side of the same screen (who holds Weavers of the Commons, and the weights) is read from the
// Contributor Access admin routes, which the screen calls directly.
//
// Admin-only and read-only. No per-event breakdown is returned for a named member: Foundation
// answered calls are among the thirteen and rule 132 keeps that participation internal.
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
