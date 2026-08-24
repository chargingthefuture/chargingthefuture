'use client';

// The member list itself: hero, any load error, one page of problems, and the page controls.
// Split out of what-works-shell.tsx to keep that component within the size limits of rule 116.
import { useTheme } from '@/hooks/useTheme';
import { getWhatWorksTokens, type WhatWorksProblem, type WhatWorksProduct, type WhatWorksStats } from './ww-shared';
import { WhatWorksHero } from './ww-hero';
import { WhatWorksProblemSection } from './ww-problem-section';
import { WhatWorksPager } from './ww-pager';

type Props = {
  stats: WhatWorksStats;
  // A load error shown above the list, when the list itself still has something to show.
  error: string | null;
  query: string;
  // The problems on the current page, and how many the search matched in total.
  pageProblems: WhatWorksProblem[];
  matchCount: number;
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
  busyProductId: string | null;
  onToggleHelpful: (product: WhatWorksProduct) => void;
  onSuggestForProblem: (problemId: string) => void;
  registerSection: (problemId: string, node: HTMLElement | null) => void;
};

export function WhatWorksListBody({
  stats, error, query, pageProblems, matchCount, page, pageCount, onPageChange,
  busyProductId, onToggleHelpful, onSuggestForProblem, registerSection,
}: Props) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <>
      <WhatWorksHero stats={stats} />
      {error ? (
        <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fecaca', fontSize: 13 }}>{error}</div>
      ) : null}
      {matchCount === 0 ? (
        <div style={{ fontSize: 14, color: t.MUTED, padding: '24px 0' }}>No tools or problems match “{query}”.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {pageProblems.map((problem) => (
            <WhatWorksProblemSection
              key={problem.id}
              problem={problem}
              busyProductId={busyProductId}
              onToggleHelpful={onToggleHelpful}
              onSuggestForProblem={onSuggestForProblem}
              sectionRef={(node) => registerSection(problem.id, node)}
            />
          ))}
        </div>
      )}
      <WhatWorksPager
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        summary={`${matchCount} ${matchCount === 1 ? 'problem' : 'problems'}`}
      />
    </>
  );
}
