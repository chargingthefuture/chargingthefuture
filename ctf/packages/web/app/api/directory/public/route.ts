import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listPublicDirectory, parsePaginationParams } from 'lib/directory/repository';
import { publicSurfaceGate } from 'lib/feature-flags';

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
  const gate = await publicSurfaceGate();
  if (gate) return gate;

  const pagination = parsePaginationParams(request.url);

  try {
    const payload = await listPublicDirectory(pagination, getFilters(request.url));
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch public directory.' },
      { status: 503 },
    );
  }
}
