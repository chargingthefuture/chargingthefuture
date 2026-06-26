'use client';

// Left icon rail from design/.../survivor-hub/WhatWorks.tsx. These glyphs are presentational
// in the mockup (no routes are wired to them), so they render as decorative, non-focusable
// elements (aria-hidden) rather than unlabeled interactive buttons.
import { ListChecks, Tag } from 'lucide-react';
import { PluginRailFooter } from '@/components/shared/plugin-rail-footer';
import { BRAND, BORDER, SUBTLE } from './ww-shared';

const decorativeTile: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function WhatWorksIconRail() {
  return (
    <aside style={{ width: 72, background: '#090B0F', borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <ListChecks size={20} color={BRAND} />
      </div>
      <div style={{ ...decorativeTile, background: `${BRAND}20`, border: `1px solid ${BRAND}40`, color: BRAND }}>
        <ListChecks size={20} />
      </div>
      <div style={{ ...decorativeTile, background: 'transparent', border: '1px solid transparent', color: SUBTLE }}>
        <Tag size={20} />
      </div>
      <PluginRailFooter />
    </aside>
  );
}
