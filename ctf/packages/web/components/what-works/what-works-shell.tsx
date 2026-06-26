'use client';

// Authenticated WhatWorks experience. Orchestrates the shared list, the live "Helpful"
// endorsement toggle, the suggest flow, client-side search, and an admin entry point.
// Layout + tokens are matched to design/.../survivor-hub/WhatWorks.tsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ListChecks, Plus, Search, ShieldCheck } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import {
  BG, BRAND, TEXT, getWhatWorksTokens,
  type SuggestDraft, type WhatWorksListResponse, type WhatWorksProblem,
  type WhatWorksProblemOption, type WhatWorksProduct, type WhatWorksStats,
} from './ww-shared';
import { WhatWorksLoading } from './ww-loading';
import { WhatWorksIconRail } from './ww-icon-rail';
import { WhatWorksSidebar } from './ww-sidebar';
import { WhatWorksHero } from './ww-hero';
import { WhatWorksRightRail } from './ww-right-rail';
import { WhatWorksProblemSection } from './ww-problem-section';
import { WhatWorksSuggestPanel } from './ww-suggest-panel';

const EMPTY_STATS: WhatWorksStats = { problems: 0, verifiedTools: 0, survivorsHelped: 0 };

function matches(query: string, ...fields: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field.toLowerCase().includes(needle));
}

function filterProblems(problems: WhatWorksProblem[], query: string): WhatWorksProblem[] {
  if (!query.trim()) return problems;
  const result: WhatWorksProblem[] = [];
  for (const problem of problems) {
    if (matches(query, problem.title, problem.context)) {
      result.push(problem);
      continue;
    }
    const products = problem.products.filter((product) => matches(query, product.name, product.kind, product.note));
    if (products.length > 0) {
      result.push({ ...problem, products });
    }
  }
  return result;
}

export function WhatWorksShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<WhatWorksProblem[]>([]);
  const [stats, setStats] = useState<WhatWorksStats>(EMPTY_STATS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [problemOptions, setProblemOptions] = useState<WhatWorksProblemOption[]>([]);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);

  async function loadList(): Promise<void> {
    setError(null);
    try {
      const res = await fetch('/api/what-works');
      if (!res.ok) throw new Error('Failed to load What Works');
      const data = (await res.json()) as WhatWorksListResponse;
      setProblems(data.problems ?? []);
      setStats(data.stats ?? EMPTY_STATS);
      setIsAdmin(Boolean(data.viewer?.isAdmin));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load What Works');
    } finally {
      setLoading(false);
    }
  }

  async function loadProblemOptions(): Promise<void> {
    try {
      const res = await fetch('/api/what-works/problems');
      if (!res.ok) return;
      const data = (await res.json()) as { problems: WhatWorksProblemOption[] };
      setProblemOptions(data.problems ?? []);
    } catch {
      // Non-fatal: the suggest dropdown simply stays empty until reload.
    }
  }

  useEffect(() => {
    void loadList();
    void loadProblemOptions();
  }, []);

  function applyEndorsement(productId: string, next: { verifiedCount: number; viewerHasEndorsed: boolean }): void {
    setProblems((prev) => prev.map((problem) => ({
      ...problem,
      products: problem.products.map((product) =>
        product.id === productId
          ? { ...product, verifiedCount: next.verifiedCount, viewerHasEndorsed: next.viewerHasEndorsed }
          : product,
      ),
    })));
  }

  async function toggleHelpful(product: WhatWorksProduct): Promise<void> {
    setBusyProductId(product.id);
    setError(null);
    const method = product.viewerHasEndorsed ? 'DELETE' : 'POST';
    try {
      const res = await fetch(`/api/what-works/products/${product.id}/endorse`, { method, headers: { 'x-ctf-csrf': '1' } });
      if (!res.ok) throw new Error('Could not update. Try again.');
      const data = (await res.json()) as { verifiedCount: number; viewerHasEndorsed: boolean };
      applyEndorsement(product.id, data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update. Try again.');
    } finally {
      setBusyProductId(null);
    }
  }

  async function submitSuggestion(draft: SuggestDraft): Promise<string | null> {
    try {
      const res = await fetch('/api/what-works/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(draft),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) return body?.message ?? 'Could not submit. Try again.';
      return null;
    } catch {
      return 'Could not submit. Try again.';
    }
  }

  function selectProblem(index: number, list: WhatWorksProblem[]): void {
    setActiveIndex(index);
    const target = list[index];
    if (target) {
      sectionRefs.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const visibleProblems = useMemo(() => filterProblems(problems, query), [problems, query]);

  if (loading) {
    return <WhatWorksLoading />;
  }

  // A failed load also leaves problems empty; show the failure rather than masking it as
  // the (legitimate) empty-list suggest state.
  if (!showSuggest && error && problems.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter', system-ui, sans-serif", alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#fecaca', marginBottom: 12 }}>{error}</div>
          <button
            type="button"
            onClick={() => { setLoading(true); void loadList(); }}
            style={{ padding: '10px 16px', borderRadius: 9, background: `${BRAND}18`, border: `1px solid ${BRAND}40`, color: BRAND, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (showSuggest || problems.length === 0) {
    return (
      <WhatWorksSuggestPanel
        problems={problemOptions}
        isFirst={problems.length === 0}
        onSubmit={submitSuggestion}
        onBack={problems.length === 0 ? undefined : () => setShowSuggest(false)}
      />
    );
  }

  const content = (
    <>
      <WhatWorksHero stats={stats} />
      {error ? (
        <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fecaca', fontSize: 13 }}>{error}</div>
      ) : null}
      {visibleProblems.length === 0 ? (
        <div style={{ fontSize: 14, color: t.MUTED, padding: '24px 0' }}>No tools or problems match “{query}”.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {visibleProblems.map((problem) => (
            <WhatWorksProblemSection
              key={problem.id}
              problem={problem}
              busyProductId={busyProductId}
              onToggleHelpful={(product) => void toggleHelpful(product)}
              sectionRef={(node) => { sectionRefs.current[problem.id] = node; }}
            />
          ))}
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ACCENT, textDecoration: 'none', flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <ListChecks size={18} color={t.ACCENT} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>What Works</span>
            {isAdmin ? (
              <Link href="/admin/what-works" aria-label="Admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: 9, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                <ShieldCheck size={13} /> Admin
              </Link>
            ) : null}
          </div>
          <div style={{ padding: '0 12px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}` }}>
              <Search size={14} color={t.MUTED} />
              <input
                aria-label="Search tools or problems"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools or problems…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: t.TITLE, fontFamily: 'inherit' }}
              />
            </div>
          </div>
          {/* The Suggest entry point lives in the desktop sidebar; mobile has no sidebar, so add it
              here so a phone user can still add an item to the shared list. */}
          <div style={{ padding: '0 12px 10px' }}>
            <button
              type="button"
              onClick={() => setShowSuggest(true)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <Plus size={15} /> Suggest an item
            </button>
          </div>
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', maxHeight: '100%', background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE, overflow: 'hidden' }}>
      <WhatWorksIconRail />
      <WhatWorksSidebar
        problems={visibleProblems}
        activeIndex={activeIndex}
        onSelectProblem={(index) => selectProblem(index, visibleProblems)}
        onSuggest={() => setShowSuggest(true)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: t.HEADER, flexShrink: 0 }}>
          <ListChecks size={18} color={t.ACCENT} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.TITLE }}>What Works</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Survivor-verified tools · by problem</div>
          </div>
          {isAdmin ? (
            <Link href="/admin/what-works" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              <ShieldCheck size={13} /> Admin
            </Link>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 9, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, width: 220 }}>
            <Search size={14} color={t.MUTED} />
            <input
              aria-label="Search tools or problems"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools or problems…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: t.TITLE, fontFamily: 'inherit' }}
            />
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '28px 40px 48px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {content}
          </div>
        </div>
      </div>

      <WhatWorksRightRail stats={stats} />
    </div>
  );
}
