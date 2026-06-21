import { NextResponse } from 'next/server';
import { beaconErrorResponse, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { listBeaconEvents } from 'lib/beacon/repository';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// Admin: list events newest-first (history + recordings).
export async function GET() {
  const gate = await requireBeaconAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const events = await listBeaconEvents();
    return NextResponse.json({ ok: true, events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'admin_list' });
    return beaconErrorResponse('Could not load events.');
  }
}
