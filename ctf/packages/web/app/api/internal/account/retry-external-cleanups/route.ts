import { NextResponse } from 'next/server';
import { retryDueExternalCleanups } from 'lib/account/external-cleanup-retries';
import { bearerMatches } from 'lib/auth/internal-secret';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';

// Cron-only: retries the Stream cleanups that failed during an account or service deletion
// (issue #2703). Guarded by CRON_SECRET (Bearer), the same as the other scheduled internal routes.
// Answers counts only — never an account id — because the workflow prints the answer to its summary.
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }
  return bearerMatches(request, cronSecret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, code: 'account_cleanup_retry_forbidden', message: 'Invalid cron secret.' },
      { status: 403 },
    );
  }

  try {
    const result = await retryDueExternalCleanups();
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'account', op: 'internal_retry_external_cleanups' });
    return NextResponse.json(
      {
        ok: false,
        code: 'account_cleanup_retry_unavailable',
        message: `Unable to retry failed Stream cleanups: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
