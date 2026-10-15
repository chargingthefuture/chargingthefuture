import { NextResponse } from 'next/server';
import { requireGdpReadAccess } from 'lib/gdp/_lib';
import { buildLiveGdpReport } from 'lib/gdp/repository';
import { failureResponse } from 'lib/errors/failure';

// The dashboard report is computed LIVE on each request from the recognition sources and the activity
// tables — there is no manual weekly publish/snapshot step. The Community Value Index here reflects
// every registered non-incentive settled-value source as of right now.
export async function GET() {
  const gate = await requireGdpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const report = await buildLiveGdpReport();
    return NextResponse.json({ ok: true, report }, { status: 200 });
  } catch (error) {
    // One failing recognition source rejects the entire report, so the reason goes to the error report
    // and the member gets a plain sentence with a reference to quote.
    return failureResponse({
      summary: 'Could not load the GDP report just now. Try again.',
      error,
      code: 'gdp_report_unavailable',
      area: 'gdp',
      op: 'report_current',
      audience: 'member',
    });
  }
}
