'use client';

// Static "what makes a good entry" guidance from design/.../survivor-hub/WhatWorksEmpty.tsx.
import { ShieldCheck } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getWhatWorksTokens } from './ww-shared';

const ENTRY_TIPS = [
  { icon: '🎯', title: 'One specific problem', detail: 'Tie each tool to a real problem survivors recognize.' },
  { icon: '🔗', title: 'A direct link', detail: 'Link straight to the exact product — not a category.' },
  { icon: '✍️', title: 'Why it worked', detail: 'A line from your experience matters more than specs.' },
  { icon: '✅', title: 'You actually used it', detail: 'Only add what genuinely helped you. No guesses.' },
];

export function WhatWorksSuggestGuidance() {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <div style={{ width: '100%', maxWidth: 540, flexShrink: 0 }}>
      <div style={{ padding: '20px', borderRadius: 16, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, marginBottom: 14 }}>What makes a good entry</div>
        {ENTRY_TIPS.map((tip) => (
          <div key={tip.title} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{tip.icon}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.TITLE, marginBottom: 2 }}>{tip.title}</div>
              <div style={{ fontSize: 11.5, color: t.MUTED, lineHeight: 1.5 }}>{tip.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 16px', borderRadius: 12, background: `${t.ACCENT}06`, border: `1px solid ${t.ACCENT}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <ShieldCheck size={13} color={t.ACCENT} />
          <span style={{ fontSize: 12, fontWeight: 600, color: t.ACCENT }}>Pick an existing problem</span>
        </div>
        <div style={{ fontSize: 11.5, color: t.MUTED, lineHeight: 1.55 }}>When you suggest a product, choose the problem it solves from the list. Admins curate the problems so the same need isn&apos;t listed twice under different names.</div>
      </div>
    </div>
  );
}
