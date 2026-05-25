import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { getPublicDirectoryById } from 'lib/directory/repository';
import { publicSurfaceGate } from 'lib/feature-flags';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: RouteParams) {
  const gate = await publicSurfaceGate();
  if (gate) return gate;

  const { id } = await params;

  try {
    const profile = await getPublicDirectoryById(id);
    if (!profile) {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Public profile not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch public profile.' },
      { status: 503 },
    );
  }
}
