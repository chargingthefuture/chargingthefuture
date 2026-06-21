import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { refreshTrustSignalSnapshot } from 'lib/trust/repository';

export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  // Recompute the caller's trust signals from their current participation before returning, so the
  // panel reflects what they have actually done instead of a frozen snapshot that nothing ever
  // refreshed. Trust is signal-only — there is no verification status to change here.
  const { extension } = await refreshTrustSignalSnapshot(decision.userId);
  return NextResponse.json(extension, { status: 200 });
}
