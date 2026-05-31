import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { listPendingComicReviews } from 'lib/comic/repository';

export async function GET(request: Request) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { searchParams } = new URL(request.url);
  const pageParam = Number.parseInt(searchParams.get('page') ?? '', 10);
  const pageSizeParam = Number.parseInt(searchParams.get('pageSize') ?? '', 10);

  try {
    const result = await listPendingComicReviews(
      Number.isNaN(pageParam) ? undefined : pageParam,
      Number.isNaN(pageSizeParam) ? undefined : pageSizeParam,
    );

    return NextResponse.json({ ok: true, items: result.items, pagination: result.pagination }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to load the review queue.' },
      { status: 503 },
    );
  }
}
