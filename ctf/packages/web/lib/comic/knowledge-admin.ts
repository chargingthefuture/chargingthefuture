import { queryDb } from 'lib/db/postgres';

// Admin curation over comic_knowledge_entries — the grounding library the assistant quotes from.
// Until 2026-08-05 the `active` flag was manual (direct DB tooling only); these two functions back
// the /admin/comic/knowledge surface so an operator can read what the assistant can quote and
// switch an entry off (or back on) without touching the database. Deactivating never deletes:
// retrieval simply skips inactive rows (lib/comic/repository.ts filters WHERE active).

export type ComicKnowledgeAdminEntry = {
  id: string;
  source: string;
  entryType: string;
  title: string | null;
  question: string | null;
  // First slice of the content so the list reads as writing, not ids. The full text is not needed
  // to decide activation in most cases; keep the payload small.
  snippet: string;
  contentLength: number;
  active: boolean;
  authoredAtIso: string | null;
  createdAtIso: string;
};

export type ComicKnowledgeAdminFilter = 'all' | 'active' | 'inactive';

const SNIPPET_LENGTH = 280;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type KnowledgeRow = {
  id: string;
  source: string;
  entry_type: string;
  title: string | null;
  question: string | null;
  snippet: string;
  content_length: number;
  active: boolean;
  authored_at: Date | null;
  created_at: Date;
};

function mapRow(row: KnowledgeRow): ComicKnowledgeAdminEntry {
  return {
    id: row.id,
    source: row.source,
    entryType: row.entry_type,
    title: row.title,
    question: row.question,
    snippet: row.snippet,
    contentLength: Number(row.content_length),
    active: row.active,
    authoredAtIso: row.authored_at ? row.authored_at.toISOString() : null,
    createdAtIso: row.created_at.toISOString(),
  };
}

type ListKnowledgeOptions = {
  page?: number;
  pageSize?: number;
  filter?: ComicKnowledgeAdminFilter;
};

function normalizeListKnowledgeOptions(options: ListKnowledgeOptions): { page: number; pageSize: number; activeFilter: boolean | null } {
  const page = Number.isFinite(options.page) && (options.page as number) > 0 ? Math.floor(options.page as number) : 1;
  const pageSizeRaw = Number.isFinite(options.pageSize) && (options.pageSize as number) > 0 ? Math.floor(options.pageSize as number) : DEFAULT_PAGE_SIZE;
  const filter: ComicKnowledgeAdminFilter = options.filter === 'active' || options.filter === 'inactive' ? options.filter : 'all';
  return {
    page,
    pageSize: Math.min(pageSizeRaw, MAX_PAGE_SIZE),
    activeFilter: filter === 'all' ? null : filter === 'active',
  };
}

export async function listKnowledgeEntriesForAdmin(options: ListKnowledgeOptions): Promise<{
  items: ComicKnowledgeAdminEntry[];
  page: number;
  pageSize: number;
  total: number;
  activeTotal: number;
}> {
  const { page, pageSize, activeFilter } = normalizeListKnowledgeOptions(options);

  const [countResult, itemsResult] = await Promise.all([
    queryDb<{ total: string; active_total: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE active)::text AS active_total
       FROM comic_knowledge_entries
       WHERE ($1::boolean IS NULL OR active = $1)`,
      [activeFilter],
    ),
    queryDb<KnowledgeRow>(
      `SELECT id, source, entry_type, title, question,
              LEFT(content, $2) AS snippet,
              LENGTH(content) AS content_length,
              active, authored_at, created_at
       FROM comic_knowledge_entries
       WHERE ($1::boolean IS NULL OR active = $1)
       ORDER BY created_at DESC, id DESC
       OFFSET $3 LIMIT $4`,
      [activeFilter, SNIPPET_LENGTH, (page - 1) * pageSize, pageSize],
    ),
  ]);

  return {
    items: itemsResult.rows.map(mapRow),
    page,
    pageSize,
    total: Number.parseInt(countResult.rows[0]?.total ?? '0', 10),
    activeTotal: Number.parseInt(countResult.rows[0]?.active_total ?? '0', 10),
  };
}

export type SetKnowledgeEntryActiveResult =
  | { status: 'updated'; entry: ComicKnowledgeAdminEntry }
  | { status: 'not_found' }
  // The entry came from a contribution its member withdrew. Withdrawal promised the assistant would
  // stop quoting them, so curation cannot switch it back on; switching it off stays allowed.
  | { status: 'withdrawn' };

// Flip one entry's active flag. Switching ON is refused for a row whose contribution was withdrawn,
// inside the same UPDATE, so a withdrawal that lands between a read and this write cannot be undone.
export async function setKnowledgeEntryActive(entryId: string, active: boolean): Promise<SetKnowledgeEntryActiveResult> {
  const result = await queryDb<KnowledgeRow>(
    `UPDATE comic_knowledge_entries
     SET active = $2
     WHERE id = $1::uuid
       AND (
         $2 = FALSE
         OR NOT EXISTS (
           SELECT 1 FROM comic_contributions c
           WHERE c.id = comic_knowledge_entries.contribution_id AND c.status = 'withdrawn'
         )
       )
     RETURNING id, source, entry_type, title, question,
               LEFT(content, $3) AS snippet,
               LENGTH(content) AS content_length,
               active, authored_at, created_at`,
    [entryId, active, SNIPPET_LENGTH],
  );
  if (result.rows[0]) {
    return { status: 'updated', entry: mapRow(result.rows[0]) };
  }

  // Nothing updated: either the id matches no row, or the guard above refused it.
  const exists = await queryDb<{ id: string }>(
    `SELECT id FROM comic_knowledge_entries WHERE id = $1::uuid`,
    [entryId],
  );
  return exists.rows.length > 0 ? { status: 'withdrawn' } : { status: 'not_found' };
}
