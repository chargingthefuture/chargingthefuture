import { NextResponse } from 'next/server';
import { sendDueRenewNotices } from 'lib/today/renew-notices';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { bearerMatches } from 'lib/auth/internal-secret';

// Cron-only: the day-14 notice for every open ask and offer whose 14 days on Today are ending, sent
// whether or not the poster opens the app (owner decision, 2026-11-10). Called once a day by
// .github/workflows/today-renew-notices.yml. Guarded by CRON_SECRET (Bearer), the convention of the
// other internal cron routes. Safe to run more than once: a notice is keyed by card and window end,
// so it is never sent twice for the same window. Answers counts only, never names.
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }
  return bearerMatches(request, cronSecret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, code: 'today_renew_notices_forbidden', message: 'Invalid cron secret.' }, { status: 403 });
  }
  try {
    const result = await sendDueRenewNotices();
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'today', op: 'internal_renew_notices_run' });
    return NextResponse.json(
      { ok: false, code: 'today_renew_notices_unavailable', message: `The day-14 notices did not run: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
