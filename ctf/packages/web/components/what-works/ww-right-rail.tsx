'use client';

// Right rail from design/.../survivor-hub/WhatWorks.tsx — trust principles, list stats,
// and the footnote link to the external "Look Ma" explainer (owner-confirmed URL).
import type { ReactNode } from 'react';
import { BadgeCheck, ExternalLink, Ban, Lock, ChevronRight } from 'lucide-react';
import { BRAND, BORDER, SURFACE, SUBTLE, TEXT, LOOK_MA_URL, type WhatWorksStats } from './ww-shared';

const PRINCIPLES: { icon: ReactNode; title: string; detail: string }[] = [
  { icon: <BadgeCheck size={15} color={BRAND} />, title: 'Survivor-verified', detail: 'Every item was used by a real member who said it helped.' },
  { icon: <ExternalLink size={15} color={BRAND} />, title: 'Direct links', detail: "Go straight to the product. We don't sell anything." },
  { icon: <Ban size={15} color={BRAND} />, title: 'No ads, no affiliates', detail: 'Nothing on this list is sponsored or paid for.' },
  { icon: <Lock size={15} color={BRAND} />, title: 'Private to suggest', detail: 'Suggesting an item never reveals who you are.' },
];

export function WhatWorksRightRail({ stats }: { stats: WhatWorksStats }) {
  const rows = [
    { label: 'Problems', value: String(stats.problems) },
    { label: 'Verified tools', value: String(stats.verifiedTools) },
    { label: 'Survivors helped', value: String(stats.survivorsHelped) },
  ];
  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${BORDER}`, background: '#0D0F14', padding: '20px 16px', flexShrink: 0, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 12 }}>How this list works</div>
      <div style={{ padding: '14px', borderRadius: 12, background: `${BRAND}06`, border: `1px solid ${BRAND}18`, marginBottom: 16 }}>
        {PRINCIPLES.map((principle) => (
          <div key={principle.title} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{principle.icon}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{principle.title}</div>
              <div style={{ fontSize: 11.5, color: SUBTLE, lineHeight: 1.5 }}>{principle.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 12 }}>This list</div>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <span style={{ fontSize: 12.5, color: SUBTLE }}>{row.label}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: BRAND }}>{row.value}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '13px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>
          One shared list for the whole community — for now. Per-survivor lists may come later.
        </div>
        <a href={LOOK_MA_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: BRAND, fontWeight: 600, textDecoration: 'none', marginTop: 8 }}>
          From the problems in “Look Ma, I Fixed It” <ChevronRight size={13} />
        </a>
      </div>
    </aside>
  );
}
