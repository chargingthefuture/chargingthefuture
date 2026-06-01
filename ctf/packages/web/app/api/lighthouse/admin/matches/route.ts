import { NextResponse } from 'next/server';
import { requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { listLighthouseMatchesAdmin } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listLighthouseMatchesAdmin();
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_match_list', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Admin match listing unavailable.' },
      { status: 503 },
    );
  }
}
