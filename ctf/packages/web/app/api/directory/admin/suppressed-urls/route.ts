import { NextResponse } from 'next/server';
import { requireDirectoryAdminAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listSuppressedQuoraUrls } from 'lib/directory/repository';
import { reportError } from 'lib/observability/report';

// Admin read of the Quora-URL suppression list (takedowns), for the admin suppression screen.
export async function GET() {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listSuppressedQuoraUrls();
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_suppressed_urls_list' });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to load the suppression list.' },
      { status: 503 },
    );
  }
}
