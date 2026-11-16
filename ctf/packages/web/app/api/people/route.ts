import { NextResponse } from 'next/server';
import { SE_PEOPLE_PAGE_SIZE, sePeopleCategory, sePeopleFilter } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { listPeople, type PeopleQuery } from 'lib/people/repository';
import { readMatchNeeds } from 'lib/today/match/repository';
import { reportError } from 'lib/observability/report';

// GET /api/people?page=&offering=1&fits=1&category=&q=: the 3.1 People screen, a page of the Directory
// with each person's Foundation offering. category is trades, care, paperwork or tech (the chips; see
// SE_PEOPLE_CATEGORY_SECTORS in @ctf/shared); anything else is ignored. fits=1 keeps the people who fit
// the needs the member saved on Today's Match card (lib/today/match). Approved members only (the
// default tier), the same bar as the Directory. A page past the end answers the last page, so an old
// link never shows nothing.

export const dynamic = 'force-dynamic';

function readQuery(url: URL): Omit<PeopleQuery, 'pageSize' | 'fitsJobTitleIds' | 'viewerId'> {
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    offeringOnly: url.searchParams.get('offering') === '1',
    query: query || null,
    category: sePeopleCategory(sePeopleFilter(url.searchParams.get('category'))),
  };
}

export async function GET(request: Request) {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  const url = new URL(request.url);
  try {
    const fits = url.searchParams.get('fits') === '1';
    const input = { ...readQuery(url), fitsJobTitleIds: fits ? ((await readMatchNeeds(decision.userId))?.jobTitleIds ?? []) : null, viewerId: decision.userId ?? null };
    let people = await listPeople({ ...input, pageSize: SE_PEOPLE_PAGE_SIZE });
    if (people.items.length === 0 && input.page > 1) {
      // The total comes with the rows, so an empty page past the end reads page 1 to learn it.
      people = await listPeople({ ...input, page: 1, pageSize: SE_PEOPLE_PAGE_SIZE });
      const lastPage = Math.max(1, Math.ceil(people.total / SE_PEOPLE_PAGE_SIZE));
      if (lastPage > 1) people = await listPeople({ ...input, page: lastPage, pageSize: SE_PEOPLE_PAGE_SIZE });
    }
    return NextResponse.json({ ok: true, people }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'people', op: 'list' });
    return NextResponse.json(
      { ok: false, code: 'PEOPLE_UNAVAILABLE', message: 'Could not read People: the Directory read failed.' },
      { status: 503 },
    );
  }
}
