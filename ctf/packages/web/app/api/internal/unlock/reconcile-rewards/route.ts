import { NextResponse } from 'next/server';
import { reconcileUnlockRewards } from 'lib/unlock/reconcile-rewards';
import { reportError } from 'lib/observability/report';

type ReconcileBody = { limit?: number };

// Cron-only: drains the approved-but-uncredited Unlock reward backlog and mints each idempotently.
// Guarded by CRON_SECRET (Bearer), matching the workforce internal-sync convention. Safe to run on a
// schedule — the mint idempotency key + the per-submission flag make double-grants impossible.
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, code: 'unlock_reconcile_forbidden', message: 'Invalid cron secret.' }, { status: 403 });
  }

  let body: ReconcileBody = {};
  try {
    body = (await request.json()) as ReconcileBody;
  } catch {
    body = {};
  }

  try {
    // body.limit is typed as number, so validate it is actually a finite number and pass it through
    // as-is (no redundant Number() cast, which was a no-op and misleadingly implied string coercion).
    const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? body.limit : undefined;
    const result = await reconcileUnlockRewards(limit);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'internal_reconcile_rewards' });
    return NextResponse.json({ ok: false, code: 'unlock_reconcile_unavailable', message: 'Unable to reconcile unlock rewards.' }, { status: 503 });
  }
}
