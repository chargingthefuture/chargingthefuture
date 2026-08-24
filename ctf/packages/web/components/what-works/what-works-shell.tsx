'use client';

// Authenticated WhatWorks experience. Orchestrates the shared list, the live "Helpful"
// endorsement toggle, the suggest flow, client-side search, and an admin entry point.
// Layout + tokens are matched to design/.../survivor-hub/WhatWorks.tsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import {
  BG, BRAND, PROBLEMS_PER_PAGE, TEXT, clampPage, getWhatWorksTokens, pageCountFor,
  type SuggestDraft, type WhatWorksListResponse, type WhatWorksProblem,
  type WhatWorksProblemOption, type WhatWorksProduct, type WhatWorksStats,
} from './ww-shared';
import { WhatWorksLoading } from './ww-loading';
import { WhatWorksSuggestPanel } from './ww-suggest-panel';
import { WhatWorksShellHeader } from './ww-shell-header';
import { WhatWorksListBody } from './ww-list-body';

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
  // Which page of problems is on screen. The list is paged, not endlessly scrolled.
  const [page, setPage] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  // Which problem the suggest form opens on. Set when a member starts from a problem's own
  // "Suggest a tool" button; empty when they use the header button and pick for themselves.
  const [suggestProblemId, setSuggestProblemId] = useState('');
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
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

  // Header refresh: re-pull the list and the suggest-dropdown options without the
  // full-screen loading state (loadList only toggles `loading` on the initial mount).
  async function refreshAll(): Promise<void> {
    await Promise.all([loadList(), loadProblemOptions()]);
  }

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

  function search(next: string): void {
    setQuery(next);
    // A narrower list can have fewer pages than the one being viewed, so start back at the first.
    setPage(0);
  }

  function goToPage(next: number): void {
    setPage(next);
    // Paging is a jump to a new set of problems, so start the reader at the top of it.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openSuggest(problemId: string): void {
    setSuggestProblemId(problemId);
    setShowSuggest(true);
  }

  const visibleProblems = useMemo(() => filterProblems(problems, query), [problems, query]);
  const pageCount = pageCountFor(visibleProblems.length, PROBLEMS_PER_PAGE);
  // The list can shrink under a page index that is already set (a search narrows it, a refresh
  // returns fewer problems), so the index is clamped rather than trusted.
  const currentPage = clampPage(page, pageCount);
  const pagedProblems = visibleProblems.slice(
    currentPage * PROBLEMS_PER_PAGE,
    currentPage * PROBLEMS_PER_PAGE + PROBLEMS_PER_PAGE,
  );
  // No approved tool anywhere yet — the suggest form says so instead of "suggest another".
  const listHasNoTools = problems.every((problem) => problem.products.length === 0);

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
        initialProblemId={suggestProblemId}
        isFirst={listHasNoTools}
        onSubmit={submitSuggestion}
        onBack={problems.length === 0 ? undefined : () => setShowSuggest(false)}
      />
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
      <WhatWorksShellHeader
        isAdmin={isAdmin}
        query={query}
        onSearch={search}
        onRefresh={refreshAll}
        onSuggest={() => openSuggest('')}
      />
      <div style={{ padding: '16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <WhatWorksListBody
            stats={stats}
            error={error}
            query={query}
            pageProblems={pagedProblems}
            matchCount={visibleProblems.length}
            page={currentPage}
            pageCount={pageCount}
            onPageChange={goToPage}
            busyProductId={busyProductId}
            onToggleHelpful={(product) => void toggleHelpful(product)}
            onSuggestForProblem={openSuggest}
            registerSection={(problemId, node) => { sectionRefs.current[problemId] = node; }}
          />
        </div>
      </div>
    </div>
  );

}
