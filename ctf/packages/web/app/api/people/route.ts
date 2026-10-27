import { NextResponse } from 'next/server';
import { SE_PEOPLE_PAGE_SIZE } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { listPeople } from 'lib/people/repository';
import { reportError } from 'lib/observability/report';

// GET /api/people?page=&offering=1&q=: the 3.1 People screen, a page of the Directory with each
// person's Foundation offering. Approved members only (the default tier), the same bar as the
// Directory. A page past the end answers the last page, so an old link never shows nothing.

export const dynamic = 'force-dynamic';

function readQuery(url: URL): { page: number; offeringOnly: boolean; query: string | null } {
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    offeringOnly: url.searchParams.get('offering') === '1',
    query: query || null,
  };
}

export async function GET(request: Request) {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  const input = readQuery(new URL(request.url));
  try {
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
