import { NextRequest, NextResponse } from 'next/server';
import { computeEligibility } from 'lib/contributor-access/eligibility';
import { syncGatedChannelMembershipIfOpen } from 'lib/contributor-access/gated-channel';
import { reportError } from 'lib/observability/report';

// Internal, schedule-driven recompute of Contributor Access eligibility. Recomputing on a schedule
// (not instantly on an action) means nobody spikes the signals and coasts; the recompute is
// additive only — it admits newly-qualified members and never revokes on signal decay (revocation
// is for-cause only, via the admin route). Called weekly by the contributor-access-recompute
// workflow.
//
// Guarded by INTERNAL_SERVICE_SECRET, the same posture as
// /api/internal/weekly-performance/goal-snapshot — never callable by browsers or members. The
// response carries counts only: no per-member data and no score ever leaves the engine.
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    // 503 (not 501): the route exists but is unconfigured in this runtime. 503 lets the caller
    // distinguish a misconfiguration from a wrong credential (401), matching the account/delete route.
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await computeEligibility();
    // Membership sync runs only while the channel is open, and a Stream failure never fails the
    // recompute response — it comes back as a warning field instead.
    const channelSyncWarning = await syncGatedChannelMembershipIfOpen('internal_recompute_channel_sync');
    return NextResponse.json(
      { ok: true, evaluated: result.evaluated, eligible: result.eligible, ...(channelSyncWarning ? { channelSyncWarning } : {}) },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'internal_recompute' });
    return NextResponse.json({ error: 'Recompute failed' }, { status: 500 });
  }
}
