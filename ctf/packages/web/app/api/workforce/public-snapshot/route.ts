import { NextResponse } from 'next/server';
import { getWorkforcePublicSnapshot } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

// Public, unauthenticated snapshot for the signed-out Workforce landing page. It returns only three
// coarse aggregate counts (Recruited / Not Recruited / Sector Gaps) from the same projection model the
// signed-in dashboard uses — no per-member rows and no identifying data — so it needs no auth gate.
// force-dynamic keeps it from being statically cached so the landing snapshot reflects current data.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getWorkforcePublicSnapshot();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'public_snapshot' });
    return NextResponse.json(
      { ok: false, code: 'workforce_snapshot_unavailable', message: 'Workforce snapshot unavailable.' },
      { status: 503 },
    );
  }
}
