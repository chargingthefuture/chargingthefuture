import { NextResponse } from 'next/server';
import { requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { getLighthouseAdminStats } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET() {
  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const stats = await getLighthouseAdminStats();
    return NextResponse.json({ ok: true, stats }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_stats' });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: `Admin stats unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
