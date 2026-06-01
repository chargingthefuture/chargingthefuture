'use client';

// Hero / purpose block from design/.../survivor-hub/WhatWorks.tsx.
import { BadgeCheck } from 'lucide-react';
import { BRAND, BORDER, SURFACE, type WhatWorksStats } from './ww-shared';

export function WhatWorksHero({ stats }: { stats: WhatWorksStats }) {
  const chips = [
    `${stats.problems} ${stats.problems === 1 ? 'problem' : 'problems'}`,
    `${stats.verifiedTools} ${stats.verifiedTools === 1 ? 'tool' : 'tools'}`,
    '100% survivor-verified',
  ];
  return (
    <div style={{ marginBottom: 28 }}>
      <span style={{ padding: '4px 12px', borderRadius: 20, background: `${BRAND}14`, border: `1px solid ${BRAND}30`, fontSize: 11.5, color: BRAND, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <BadgeCheck size={13} /> Survivor-verified · one shared list
      </span>
      <h1 style={{ margin: '14px 0 8px', fontSize: 30, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
        What actually <span style={{ color: BRAND }}>works</span>.
      </h1>
      <p style={{ margin: 0, fontSize: 14.5, color: '#9CA3AF', lineHeight: 1.65, maxWidth: 600 }}>
        Pick a problem you&apos;re facing. Underneath it is a list of specific tools a survivor here actually bought, used, and said helped — with a direct link to get it.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {chips.map((chip) => (
          <span key={chip} style={{ padding: '5px 11px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{chip}</span>
        ))}
      </div>
    </div>
  );
}
