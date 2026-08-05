import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { listKnowledgeEntriesForAdmin, type ComicKnowledgeAdminFilter } from 'lib/comic/knowledge-admin';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// Admin: browse the assistant's grounding library (comic_knowledge_entries) with its active flags —
// the read half of knowledge curation. Command comic.admin.knowledge.list.
export async function GET(request: Request) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) return gate.response;

  const url = new URL(request.url);
  const filterRaw = url.searchParams.get('filter') ?? 'all';
  if (!['all', 'active', 'inactive'].includes(filterRaw)) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'filter must be one of: all, active, inactive.' },
      { status: 400 },
    );
  }

  try {
    const result = await listKnowledgeEntriesForAdmin({
      page: Number.parseInt(url.searchParams.get('page') ?? '', 10),
      pageSize: Number.parseInt(url.searchParams.get('pageSize') ?? '', 10),
      filter: filterRaw as ComicKnowledgeAdminFilter,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'admin_knowledge_list' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: `Could not load knowledge entries: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
