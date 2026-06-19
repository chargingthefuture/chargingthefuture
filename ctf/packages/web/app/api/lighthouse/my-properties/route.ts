import { NextResponse } from 'next/server';
import { requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { getHostQuoraUrl, listMyProperties } from 'lib/lighthouse/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listMyProperties(gate.auth.userId);
    // Host identity for the self-hosting view is composed from existing data; the Quora link comes
    // from the member's Unlock submission. The browse shell ignores this extra `host` field.
    const quoraProfileUrl = await getHostQuoraUrl(gate.auth.userId);
    return NextResponse.json({ ok: true, items, host: { quoraProfileUrl } }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'lighthouse', op: 'my_properties' });
    return NextResponse.json(
      { ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'My property listing unavailable.' },
      { status: 503 },
    );
  }
}
