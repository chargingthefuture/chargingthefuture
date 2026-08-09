import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { getComicTrainingStats } from 'lib/comic/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// Admin-only at-a-glance counts of the accumulated @comic training signal: the total owner-correction
// training examples (with a per-status breakdown) and how many answered turns have been rated. Read
// only, used by the review dashboard to show how much data has built up so far. Best-effort: a
// failure just hides the counter, it never blocks the review queue.
export async function GET() {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const stats = await getComicTrainingStats();
    return NextResponse.json({ ok: true, stats }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'training_stats' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: `Unable to read training stats: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
