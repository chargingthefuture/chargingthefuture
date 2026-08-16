'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WORKFORCE_SKILL_LEVELS } from '../../lib/workforce/skill-level';
import type { WorkforceOccupation } from '../../lib/workforce/types';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';

const PAGE_SIZE = 20;
const FETCH_PAGE_SIZE = 100; // API max; we page through to load the full list for client-side filtering.

const SKILL_BADGE: Record<string, string> = {
  Foundational: '#3B82F6',
  Intermediate: '#F59E0B',
  Advanced: '#22C55E',
};

async function fetchAllOccupations(signal: AbortSignal): Promise<WorkforceOccupation[]> {
  const first = await fetch(`/api/workforce/occupations?page=1&pageSize=${FETCH_PAGE_SIZE}`, { signal });
  if (!first.ok) {
    throw new Error(`Request failed (${first.status}).`);
  }
  const firstJson = (await first.json()) as {
    items?: WorkforceOccupation[];
    pagination?: { total?: number };
  };
  const items = firstJson.items ?? [];
  const total = firstJson.pagination?.total ?? items.length;
  const pages = Math.ceil(total / FETCH_PAGE_SIZE);
  if (pages <= 1) {
    return items;
  }
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      fetch(`/api/workforce/occupations?page=${i + 2}&pageSize=${FETCH_PAGE_SIZE}`, { signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: WorkforceOccupation[] }) => j.items ?? []),
    ),
  );
  return items.concat(...rest);
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? t.TITLE }}>{value}</div>
    </div>
  );
}

function OccupationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const [occ, setOcc] = useState<WorkforceOccupation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/workforce/occupations/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Request failed (${r.status}).`);
        return r.json();
      })
      .then((j: { occupation?: WorkforceOccupation } | null) => setOcc(j?.occupation ?? null))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Failed to load.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: t.SUBTLE,
          fontSize: 13,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        <ArrowLeft size={16} /> Back to occupations
      </button>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.MUTED, fontSize: 13 }}>
          <Loader2 size={14} className="ctf-spin" /> Loading occupation…
        </div>
      ) : error ? (
        <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>
      ) : !occ ? (
        <div style={{ fontSize: 13, color: t.MUTED }}>Occupation not found.</div>
      ) : (
        <>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.TITLE }}>{occ.name}</div>
            <div style={{ fontSize: 13, color: t.MUTED, marginTop: 2 }}>
              {occ.sector} · {occ.skillLevel}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Stat label="Headcount goal (demand)" value={occ.target.toLocaleString()} />
            <Stat label="Annual training goal" value={occ.annualTrainingTarget.toLocaleString()} />
            {/* No "Members" (declared-occupation) card: members join jobless but skilled, so the
                declared count is ~always 0 and reads as an error. Recruited (matched) carries the
                story; occ.members stays in the API for consumers that need the declared count. */}
            <Stat label="Recruited (matched)" value={occ.recruited.toLocaleString()} accent="#22C55E" />
            <Stat
              label="Roles to fill"
              value={occ.gap > 0 ? occ.gap.toLocaleString() : '—'}
              accent={occ.gap > 0 ? t.ACCENT : '#22C55E'}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              color: t.MUTED,
              lineHeight: 1.7,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            How these are computed: the <strong>headcount goal</strong> is this occupation&apos;s share of
            its sector&apos;s demand — population × participation rate, split across sectors by each
            sector&apos;s workforce share, then divided evenly among the sector&apos;s job titles. The{' '}
            <strong>annual training goal</strong> is a share of that goal by skill level (Foundational
            10%, Intermediate 15%, Advanced 25%). <strong>Recruited</strong> is the distinct Directory
            members who match this occupation by sector, job title, or a registered skill. The{' '}
            <strong>training gap</strong> is the goal minus recruited.
          </div>
        </>
      )}
    </div>
  );
}

export function WorkforceOccupations() {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const [all, setAll] = useState<WorkforceOccupation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('all');
  const [skillLevel, setSkillLevel] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchAllOccupations(controller.signal)
      .then((items) => setAll(items))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Failed to load.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    all.forEach((o) => { if (o.sector) set.add(o.sector); });
    return Array.from(set).sort();
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((o) => {
      if (sector !== 'all' && o.sector !== sector) return false;
      if (skillLevel !== 'all' && o.skillLevel !== skillLevel) return false;
      if (q && !(`${o.name} ${o.sector}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [all, search, sector, skillLevel]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px',
    background: t.INPUT_BG,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    fontSize: 13,
    color: t.TEXT,
    outline: 'none',
  };

  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: 24 }}>
        {selectedId ? (
          <OccupationDetail id={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE, marginBottom: 16 }}>
              Occupations
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search occupations…"
                style={{ ...selectStyle, flex: 1, minWidth: 180 }}
              />
              <select value={sector} onChange={(e) => { setSector(e.target.value); setPage(0); }} style={selectStyle}>
                <option value="all">All sectors</option>
                {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={skillLevel} onChange={(e) => { setSkillLevel(e.target.value); setPage(0); }} style={selectStyle}>
                <option value="all">All skill levels</option>
                {WORKFORCE_SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.MUTED, fontSize: 13 }}>
                <Loader2 size={14} className="ctf-spin" /> Loading occupations…
              </div>
            ) : error ? (
              <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div style={{ fontSize: 13, color: t.MUTED }}>No occupations match these filters.</div>
            ) : (
              <>
                <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  {rows.map((o, i) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: t.TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {o.name}
                        </div>
                        <div style={{ fontSize: 12, color: t.MUTED }}>{o.sector}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: SKILL_BADGE[o.skillLevel] ?? t.SUBTLE,
                          background: `${SKILL_BADGE[o.skillLevel] ?? t.SUBTLE}1A`,
                          border: `1px solid ${SKILL_BADGE[o.skillLevel] ?? t.SUBTLE}40`,
                          borderRadius: 6,
                          padding: '1px 7px',
                          flexShrink: 0,
                        }}
                      >
                        {o.skillLevel}
                      </span>
                      <span style={{ width: 110, textAlign: 'right', fontSize: 12, color: t.MUTED, flexShrink: 0 }}>
                        {o.recruited.toLocaleString()} / {o.target.toLocaleString()}
                      </span>
                      <span style={{ width: 96, textAlign: 'right', fontSize: 13, fontWeight: 700, color: o.gap > 0 ? t.ACCENT : '#22C55E', flexShrink: 0 }}>
                        {o.gap > 0 ? `${o.gap.toLocaleString()} to fill` : 'filled'}
                      </span>
                      <Eye size={16} style={{ color: t.MUTED, flexShrink: 0 }} />
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: t.MUTED }}>
                    {filtered.length.toLocaleString()} occupations
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      disabled={current === 0}
                      onClick={() => setPage(current - 1)}
                      style={{ ...selectStyle, cursor: current === 0 ? 'default' : 'pointer', opacity: current === 0 ? 0.5 : 1 }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: 12, color: t.SUBTLE }}>
                      Page {current + 1} of {pageCount}
                    </span>
                    <button
                      type="button"
                      disabled={current >= pageCount - 1}
                      onClick={() => setPage(current + 1)}
                      style={{ ...selectStyle, cursor: current >= pageCount - 1 ? 'default' : 'pointer', opacity: current >= pageCount - 1 ? 0.5 : 1 }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
