import { NextResponse } from 'next/server';
import { requireDirectoryReadAccess } from '../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryForMember, parsePaginationParams } from 'lib/directory/repository';
import { reportError } from 'lib/observability/report';

function getFilters(url: string) {
  const params = new URL(url).searchParams;

  return {
    sectorId: params.get('sectorId'),
    jobTitleId: params.get('jobTitleId'),
    skillId: params.get('skillId'),
    q: params.get('q'),
  };
}

export async function GET(request: Request) {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const pagination = parsePaginationParams(request.url);

  try {
    const payload = await listDirectoryForMember(pagination, getFilters(request.url));
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'list_members', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch directory list.' },
      { status: 503 },
    );
  }
}
