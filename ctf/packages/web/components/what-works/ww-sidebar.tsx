'use client';

// Left jump-nav from design/.../survivor-hub/WhatWorks.tsx — problems list + suggest CTA.
import { Plus } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getWhatWorksTokens, type WhatWorksProblem } from './ww-shared';

type Props = {
  problems: WhatWorksProblem[];
  activeIndex: number;
  onSelectProblem: (index: number) => void;
  onSuggest: () => void;
};

export function WhatWorksSidebar({ problems, activeIndex, onSelectProblem, onSuggest }: Props) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: t.MUTED, textTransform: 'uppercase', marginBottom: 4 }}>🧰 What Works</div>
        <div style={{ fontSize: 12, color: t.FAINT, lineHeight: 1.5 }}>One shared list of tools that solved a specific problem</div>
      </div>
      <div style={{ flex: 1, padding: '4px 12px', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: t.FAINT, textTransform: 'uppercase', padding: '8px 8px 6px' }}>Problems</div>
        {problems.map((problem, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={problem.id}
              type="button"
              onClick={() => onSelectProblem(index)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, marginBottom: 2, background: active ? `${t.ACCENT}14` : 'transparent', border: active ? `1px solid ${t.ACCENT}30` : '1px solid transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{problem.emoji || '🧰'}</span>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? t.TITLE : t.SUBTLE, lineHeight: 1.3 }}>{problem.title}</span>
              <span style={{ fontSize: 11, color: t.MUTED, flexShrink: 0 }}>{problem.products.length}</span>
            </button>
          );
        })}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${t.BORDER_SOLID}` }}>
        <button
          type="button"
          onClick={onSuggest}
          style={{ width: '100%', padding: '10px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          <Plus size={15} /> Suggest an item
        </button>
        <div style={{ fontSize: 10.5, color: t.FAINT, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>Suggestions are reviewed before they&apos;re added to the shared list.</div>
      </div>
    </aside>
  );
}
