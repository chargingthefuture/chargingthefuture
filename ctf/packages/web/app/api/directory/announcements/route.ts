import { NextResponse } from 'next/server';
import { requireDirectoryReadAccess } from '../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryAnnouncements } from 'lib/directory/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listDirectoryAnnouncements(true);
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'list_announcements', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch announcements.' },
      { status: 503 },
    );
  }
}
