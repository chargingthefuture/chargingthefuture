import { NextResponse } from 'next/server';
import { readGpuBillConfig, readGpuBillNow } from 'lib/admin-expenses/gpu-bill';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Cron-only: the daily read of the RunPod drafting bill (.github/workflows/runpod-gpu-bill-read.yml).
// Guarded by CRON_SECRET (Bearer), like the other internal schedule routes. Safe to run any number of
// times: a day RunPod may still add to is rewritten, a settled day is never changed.
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, code: 'admin_expenses_gpu_bill_forbidden', message: 'Invalid cron secret.' }, { status: 403 });
  }
  // Not set up (no key, or OLLAMA_BASE_URL is not a RunPod address) is not a failure: the screen keeps
  // the typed figure and says why. Answer 200 so the schedule does not go red every day for it.
  const config = readGpuBillConfig();
  if (!config.ok) {
    return NextResponse.json({ ok: true, skipped: true, message: config.reason });
  }
  try {
    const result = await readGpuBillNow();
    return NextResponse.json({ ok: true, endpoints: result.endpointIds.length, daysRead: result.daysRead, readAt: result.readAt });
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'internal_read_gpu_bill' });
    return NextResponse.json({ ok: false, code: 'admin_expenses_gpu_bill_unavailable', message: `The RunPod bill could not be read: ${failureReason(error)}` }, { status: 503 });
  }
}
