import { NextRequest, NextResponse } from 'next/server';
import { requireLighthouseAdminAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { listLighthouseProfiles } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export async function GET(request: NextRequest) {
  const gate = await requireLighthouseAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const rawType = request.nextUrl.searchParams.get('profileType');
  if (rawType && rawType !== 'seeker' && rawType !== 'host') {
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'profileType must be seeker or host.' },
      { status: 400 },
    );
  }

  try {
    const items = await listLighthouseProfiles(rawType === 'seeker' || rawType === 'host' ? rawType : undefined);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'admin_profiles' });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: `Profile listing unavailable: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
