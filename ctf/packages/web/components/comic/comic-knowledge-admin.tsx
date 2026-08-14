'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { useTheme } from '@/hooks/useTheme';
import { getComicTokens } from './comic-shared';
import { failureText } from 'lib/errors/client-failure';

// Admin curation of the assistant's grounding library (comic_knowledge_entries). Until 2026-08-05
// the `active` flag was reachable only with direct DB tooling; this screen lists what the assistant
// can quote and lets an operator switch an entry off (or back on). Off never deletes — retrieval
// simply skips inactive rows.

type ComicTokens = ReturnType<typeof getComicTokens>;

type KnowledgeEntry = {
  id: string;
  source: string;
  entryType: string;
  title: string | null;
  question: string | null;
  snippet: string;
  contentLength: number;
  active: boolean;
  createdAtIso: string;
};

type Filter = 'all' | 'active' | 'inactive';

type ListResponse = {
  items?: KnowledgeEntry[];
  total?: number;
  activeTotal?: number;
  message?: string;
};

const PAGE_SIZE = 20;

function parseKnowledgePage(data: ListResponse | null): { ok: true; items: KnowledgeEntry[]; total: number; activeTotal: number } {
  return { ok: true, items: data?.items ?? [], total: data?.total ?? 0, activeTotal: data?.activeTotal ?? 0 };
}

async function fetchKnowledgePage(
  page: number,
  filter: Filter,
): Promise<{ ok: true; items: KnowledgeEntry[]; total: number; activeTotal: number } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/comic/admin/knowledge?page=${page}&pageSize=${PAGE_SIZE}&filter=${filter}`);
    const data = (await res.json().catch(() => null)) as ListResponse | null;
    if (!res.ok) {
      return { ok: false, message: data?.message ?? `Could not load knowledge entries (status ${res.status}).` };
    }
    return parseKnowledgePage(data);
  } catch (err) {
    return { ok: false, message: failureText(err, { fallback: 'Could not load knowledge entries.', area: 'comic', op: 'admin_knowledge_list' }) };
  }
}

function FilterPills({ filter, onChange, t }: { filter: Filter; onChange: (f: Filter) => void; t: ComicTokens }) {
  return (
    <div role="tablist" aria-label="Entry filter" style={{ display: 'inline-flex', gap: 6, marginBottom: 14 }}>
      {(['all', 'active', 'inactive'] as const).map((value) => {
        const selected = value === filter;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(value)}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
              background: selected ? `${t.ACCENT}20` : 'transparent',
              border: `1px solid ${selected ? `${t.ACCENT}60` : t.BORDER_SOLID}`,
              color: selected ? t.ACCENT : t.MUTED,
            }}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

function EntryCard({ entry, busy, onToggle, t }: {
  entry: KnowledgeEntry;
  busy: boolean;
  onToggle: (entry: KnowledgeEntry) => void;
  t: ComicTokens;
}) {
  const heading = entry.title ?? entry.question ?? '(untitled)';
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, opacity: entry.active ? 1 : 0.65 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0 }}>{heading}</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.MUTED }}>{entry.source} · {entry.entryType}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: entry.active ? '#22C55E' : t.MUTED }}>{entry.active ? 'active' : 'off'}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(entry)}
          style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE }}
        >
          {busy ? '…' : entry.active ? 'Switch off' : 'Switch on'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
        {entry.snippet}{entry.contentLength > entry.snippet.length ? '…' : ''}
      </div>
      <div style={{ fontSize: 10, color: t.FAINT, marginTop: 6 }}>Added {new Date(entry.createdAtIso).toLocaleDateString()} · {entry.contentLength.toLocaleString()} characters</div>
    </div>
  );
}

export function ComicKnowledgeAdmin() {
  const { theme } = useTheme();
  const t = getComicTokens(theme);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number, nextFilter: Filter, append: boolean) => {
    setLoading(true);
    setError(null);
    const outcome = await fetchKnowledgePage(nextPage, nextFilter);
    if (!outcome.ok) {
      setError(outcome.message);
    } else {
      setEntries((prev) => (append ? [...prev, ...outcome.items] : outcome.items));
      setPage(nextPage);
      setTotal(outcome.total);
      setActiveTotal(outcome.activeTotal);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(1, filter, false);
  }, [filter, load]);

  async function toggle(entry: KnowledgeEntry) {
    setBusyId(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/comic/admin/knowledge/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ active: !entry.active }),
      });
      const data = (await res.json().catch(() => null)) as { entry?: KnowledgeEntry; message?: string } | null;
      if (!res.ok) {
        setError(data?.message ?? `Could not update the entry (status ${res.status}).`);
        return;
      }
      const updated = data?.entry;
      if (updated) {
        setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setActiveTotal((prev) => prev + (updated.active ? 1 : -1));
      }
    } catch (err) {
      setError(failureText(err, { fallback: 'Could not update the entry.', area: 'comic', op: 'admin_knowledge_set_active' }));
    } finally {
      setBusyId(null);
    }
  }

  const hasMore = entries.length < total;

  return (
    <div style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <MobileScreenHeader title="AI Knowledge Base" accent={t.ACCENT} icon={<BookOpen size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '20px 16px 48px' }}>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 12, lineHeight: 1.6 }}>
          Everything the assistant can quote. Switching an entry off removes it from retrieval without
          deleting it — switch it back on any time. {activeTotal.toLocaleString()} of {total.toLocaleString()} entries active in this view.
        </div>

        <FilterPills filter={filter} onChange={setFilter} t={t} />

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}

        {loading && entries.length === 0 ? (
          <div style={{ fontSize: 13, color: t.MUTED }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ fontSize: 13, color: t.MUTED }}>No knowledge entries {filter === 'all' ? 'yet' : `are ${filter}`}.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} busy={busyId === entry.id} onToggle={(e) => void toggle(e)} t={t} />
            ))}
          </div>
        )}

        {hasMore && !loading ? (
          <button
            type="button"
            onClick={() => void load(page + 1, filter, true)}
            style={{ marginTop: 14, padding: '9px 16px', borderRadius: 10, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
