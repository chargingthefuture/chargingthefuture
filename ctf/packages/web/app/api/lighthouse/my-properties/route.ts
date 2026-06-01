import { NextResponse } from 'next/server';
import { requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { listMyProperties } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listMyProperties(gate.auth.userId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'my_property_list', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'My property listing unavailable.' },
      { status: 503 },
    );
  }
}
