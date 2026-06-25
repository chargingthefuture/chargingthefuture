import { NextResponse } from 'next/server';
import { requireGdpReadAccess } from 'lib/gdp/_lib';
import { buildLiveGdpReport } from 'lib/gdp/repository';

// The dashboard report is computed LIVE on each request from the recognition sources and the activity
// tables — there is no manual weekly publish/snapshot step. The Community Value Index here reflects
// every registered non-incentive settled-value source as of right now.
export async function GET() {
  const gate = await requireGdpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const report = await buildLiveGdpReport();
  return NextResponse.json({ ok: true, report }, { status: 200 });
}
