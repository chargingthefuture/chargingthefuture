'use client';

// Static "what makes a good entry" guidance from design/.../survivor-hub/WhatWorksEmpty.tsx.
import { ShieldCheck } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BRAND, BORDER, SURFACE, SUBTLE, TEXT } from './ww-shared';

const ENTRY_TIPS = [
  { icon: '🎯', title: 'One specific problem', detail: 'Tie each tool to a real problem survivors recognize.' },
  { icon: '🔗', title: 'A direct link', detail: 'Link straight to the exact product — not a category.' },
  { icon: '✍️', title: 'Why it worked', detail: 'A line from your experience matters more than specs.' },
  { icon: '✅', title: 'You actually used it', detail: 'Only add what genuinely helped you. No guesses.' },
];

export function WhatWorksSuggestGuidance() {
  const isMobile = useIsMobile();
  return (
    <div style={{ width: isMobile ? '100%' : 300, maxWidth: isMobile ? 540 : undefined, flexShrink: 0 }}>
      <div style={{ padding: '20px', borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND, marginBottom: 14 }}>What makes a good entry</div>
        {ENTRY_TIPS.map((tip) => (
          <div key={tip.title} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{tip.icon}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{tip.title}</div>
              <div style={{ fontSize: 11.5, color: SUBTLE, lineHeight: 1.5 }}>{tip.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 16px', borderRadius: 12, background: `${BRAND}06`, border: `1px solid ${BRAND}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <ShieldCheck size={13} color={BRAND} />
          <span style={{ fontSize: 12, fontWeight: 600, color: BRAND }}>Pick an existing problem</span>
        </div>
        <div style={{ fontSize: 11.5, color: SUBTLE, lineHeight: 1.55 }}>When you suggest a product, choose the problem it solves from the list. Admins curate the problems so the same need isn&apos;t listed twice under different names.</div>
      </div>
    </div>
  );
}
