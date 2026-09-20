import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { readDailyExchangeActivity } from 'lib/engagement/exchange-activity';
import { countEligibleMembers, listEligibleMembers } from 'lib/contributor-access/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// The two readings of the value events, side by side, for the Daily exchange screen.
//
// `reading` is today and the last thirty days: how many members delivered value on a day, against
// the 384 target, plus today's roster. `weavers` is the lifetime side: how many members have earned
// Weavers of the Commons and the most recent of them. Same events, same weights, same attribution —
// the badge asks it of a member's entire time here, scoring every event behind its counterparty
// gate, and the daily count asks it of one day, drawing only on the events that deliver something.
//
// Admin-only and read-only. No per-event breakdown is returned for a named member: Foundation
// answered calls are among the fourteen and rule 132 keeps that participation internal.
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
    const [reading, weaversCount, weaversMembers] = await Promise.all([
      readDailyExchangeActivity(30),
      countEligibleMembers(),
      listEligibleMembers(),
    ]);

    // Newest first, and only the most recent few: this widget answers "is anybody still arriving",
    // not "list everybody", which the Contributor Access screen already does.
    const recent = weaversMembers
      .filter((member) => !member.revokedForCause)
      .slice(-8)
      .reverse()
      .map((member) => ({ username: member.username, firstEarnedAt: member.firstEarnedAt }));

    return NextResponse.json(
      { reading, weavers: { holders: weaversCount, recent } },
      { status: 200 },
    );
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
