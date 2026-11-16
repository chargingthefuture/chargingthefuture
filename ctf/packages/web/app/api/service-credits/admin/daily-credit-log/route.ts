import { NextResponse } from 'next/server';
import { requireServiceCreditsAdminAccess } from 'lib/service-credits/_lib';
import { insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { countDailyCreditCards, listClosedDailyCreditCards, listDailyCreditCardsPage } from 'lib/today/daily-credit/audit-log';
import {
  clampDailyCreditPage,
  dailyCreditLogMemberIds,
  dailyCreditPageCount,
  summarizeDailyCredits,
  toDailyCreditLogRows,
} from 'lib/today/daily-credit/audit-summary';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

const COMMAND = 'service-credits.admin.daily-credit-log.get';

// GET /api/service-credits/admin/daily-credit-log?page=N — admin-only, read-only audit log of the
// day's credit card on Today: every day's card, who answered "I can help", who the asker picked,
// and whether the credit was granted or held for Unlock, newest day first, a page at a time. Also
// per-asker and per-helper summaries over every closed card, and the asker/helper pairs that
// repeat three or more times. It changes nothing. Every read writes an audit row, because looking
// at who gives credits to whom is itself a use of admin power. Members are named by username only.
export async function GET(request: Request) {
  const gate = await requireServiceCreditsAdminAccess({ command: COMMAND });
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const total = await countDailyCreditCards();
    const page = clampDailyCreditPage(new URL(request.url).searchParams.get('page'), total);
    const [pageRecords, closed] = await Promise.all([listDailyCreditCardsPage(page), listClosedDailyCreditCards()]);
    const rows = toDailyCreditLogRows(pageRecords, closed);
    const summaries = summarizeDailyCredits(closed);

    // A failed name lookup still returns the log, with bare ids, and the screen says so.
    let namesUnavailable = false;
    const names = await resolveUsernames(dailyCreditLogMemberIds(rows, summaries)).catch((error) => {
      reportError(error, { area: 'service-credits', op: 'daily_credit_log_names' });
      namesUnavailable = true;
      return new Map<string, string | null>();
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: COMMAND,
      policyStatus: 'allow',
      reason: 'daily_credit_audit_read',
      targetType: 'today_daily_credit_log',
      targetId: `page:${page}`,
      metadata: { page, total, rowCount: rows.length, repeatPairs: summaries.repeatPairs.length },
    });

    return NextResponse.json(
      {
        ok: true,
        page,
        pageCount: dailyCreditPageCount(total),
        total,
        rows,
        summaries,
        names: Object.fromEntries(names),
        namesUnavailable,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'daily_credit_log' });
    return NextResponse.json(
      { ok: false, code: 'service_credits_persistence_unavailable', message: `Unable to read the daily credit log: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
