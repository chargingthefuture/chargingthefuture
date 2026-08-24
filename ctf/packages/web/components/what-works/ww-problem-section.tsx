'use client';

// A problem heading plus its survivor-verified tools, from design/.../survivor-hub/WhatWorks.tsx.
import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import {
  TOOLS_SHOWN_COLLAPSED, getWhatWorksTokens,
  type WhatWorksProblem, type WhatWorksProduct, type WhatWorksTokens,
} from './ww-shared';
import { WhatWorksProductCard } from './ww-product-card';

type Props = {
  problem: WhatWorksProblem;
  busyProductId: string | null;
  onToggleHelpful: (product: WhatWorksProduct) => void;
  onSuggestForProblem: (problemId: string) => void;
  sectionRef?: (node: HTMLElement | null) => void;
};

// A problem an admin has added that nobody has had a tool approved for yet. The heading still
// shows — that is how a member knows the category exists — with an invitation to add the first
// tool, which opens the suggest form with this problem already picked.
function NoToolsYet({ t, onSuggest }: { t: WhatWorksTokens; onSuggest: () => void }) {
  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, background: t.SURFACE, border: `1px dashed ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, marginBottom: 12 }}>
        No tools on this one yet. If something helped you here, add it — you would be the first.
      </div>
      <button
        type="button"
        onClick={onSuggest}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: `${t.ACCENT}18`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
      >
        <Plus size={14} /> Suggest a tool
      </button>
    </div>
  );
}

// Expand / collapse control for the tools this problem keeps hidden. It names the number so a
// reader knows what is behind it before tapping.
function MoreToolsToggle({ t, hiddenCount, expanded, onToggle }: { t: WhatWorksTokens; hiddenCount: number; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.SUBTLE, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
    >
      {expanded ? (
        <>
          <ChevronUp size={14} /> Show fewer
        </>
      ) : (
        <>
          <ChevronDown size={14} /> Show {hiddenCount} more {hiddenCount === 1 ? 'tool' : 'tools'}
        </>
      )}
    </button>
  );
}

export function WhatWorksProblemSection({ problem, busyProductId, onToggleHelpful, onSuggestForProblem, sectionRef }: Props) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  // Collapsed by default: a problem with many tools would otherwise stretch the page on its own.
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(problem.products.length - TOOLS_SHOWN_COLLAPSED, 0);
  const shownProducts = expanded ? problem.products : problem.products.slice(0, TOOLS_SHOWN_COLLAPSED);
  return (
    <section ref={sectionRef}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{problem.emoji || '🧰'}</div>
        <div style={{ flex: 1, paddingTop: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.TITLE }}>{problem.title}</h2>
            <span style={{ fontSize: 11.5, color: t.MUTED, fontWeight: 600 }}>
              {problem.products.length === 1 ? '1 tool' : `${problem.products.length} tools`}
            </span>
          </div>
          {problem.context ? (
            <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.5, marginTop: 3 }}>{problem.context}</div>
          ) : null}
        </div>
      </div>

      {problem.products.length === 0 ? (
        <NoToolsYet t={t} onSuggest={() => onSuggestForProblem(problem.id)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shownProducts.map((product) => (
            <WhatWorksProductCard
              key={product.id}
              product={product}
              busy={busyProductId === product.id}
              onToggleHelpful={onToggleHelpful}
            />
          ))}
          {hiddenCount > 0 ? (
            <MoreToolsToggle t={t} hiddenCount={hiddenCount} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
          ) : null}
        </div>
      )}
    </section>
  );
}
