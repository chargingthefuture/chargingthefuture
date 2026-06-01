import { NextResponse } from 'next/server';
import { requireDirectoryReadAccess } from '../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listTaxonomySkills } from 'lib/directory/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const jobTitleId = new URL(request.url).searchParams.get('jobTitleId');

  try {
    const items = await listTaxonomySkills(jobTitleId);
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'skills' });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch skills.' },
      { status: 503 },
    );
  }
}
