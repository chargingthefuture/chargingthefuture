import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { reportError } from 'lib/observability/report';
import { listAnnouncements } from 'lib/workforce/repository';

export async function GET() {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const announcements = await listAnnouncements(true);
    return NextResponse.json({ announcements }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'announcements_list', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch announcements.' },
      { status: 503 },
    );
  }
}
