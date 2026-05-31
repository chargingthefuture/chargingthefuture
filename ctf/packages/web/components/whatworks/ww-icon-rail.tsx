'use client';

// Left icon rail from design/.../survivor-hub/WhatWorks.tsx. The glyphs below the primary
// nav are presentational, matching the mockup (no routes are wired to them).
import { ListChecks, Tag, Bell, Settings } from 'lucide-react';
import { BRAND, BORDER, SUBTLE } from './ww-shared';

export function WhatWorksIconRail() {
  return (
    <aside style={{ width: 72, background: '#090B0F', borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <ListChecks size={20} color={BRAND} />
      </div>
      <button style={{ width: 44, height: 44, borderRadius: 12, background: `${BRAND}20`, border: `1px solid ${BRAND}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: BRAND }}>
        <ListChecks size={20} />
      </button>
      <button style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: SUBTLE }}>
        <Tag size={20} />
      </button>
      <div style={{ flex: 1 }} />
      <button style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: SUBTLE }}><Bell size={18} /></button>
      <button style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: SUBTLE }}><Settings size={18} /></button>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${BRAND}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: BRAND }}>S</div>
    </aside>
  );
}
