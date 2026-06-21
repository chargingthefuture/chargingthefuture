import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getTrustUserExtension, refreshTrustSignalSnapshot } from 'lib/trust/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  // Recompute the caller's trust signals from their current participation before returning, so the
  // panel reflects what they have actually done instead of a frozen snapshot that nothing ever
  // refreshed. Trust is signal-only — there is no verification status to change here.
  //
  // Resilience: if the recompute throws (an upstream table is briefly unavailable, the DB hiccups,
  // etc.) fall back to the last stored extension so the panel still renders the most recent good
  // evidence instead of erroring. A failed refresh must never break the member's own read.
  try {
    const { extension } = await refreshTrustSignalSnapshot(decision.userId);
    return NextResponse.json(extension, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust', op: 'self_refresh' });
    const extension = await getTrustUserExtension(decision.userId);
    return NextResponse.json(extension, { status: 200 });
  }
}
