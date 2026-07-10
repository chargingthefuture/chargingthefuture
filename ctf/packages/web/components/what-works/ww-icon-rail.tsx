'use client';

// Left icon rail from design/.../survivor-hub/WhatWorks.tsx. These glyphs are presentational
// in the mockup (no routes are wired to them), so they render as decorative, non-focusable
// elements (aria-hidden) rather than unlabeled interactive buttons.
import { ListChecks, Tag } from 'lucide-react';
import { PluginRailFooter } from '@/components/shared/plugin-rail-footer';
import { useTheme } from '@/hooks/useTheme';
import { getWhatWorksTokens } from './ww-shared';

const decorativeTile: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function WhatWorksIconRail() {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <aside style={{ width: 72, background: t.RAIL, borderRight: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}25`, border: `1px solid ${t.ACCENT}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <ListChecks size={20} color={t.ACCENT} />
      </div>
      <div style={{ ...decorativeTile, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT }}>
        <ListChecks size={20} />
      </div>
      <div style={{ ...decorativeTile, background: 'transparent', border: '1px solid transparent', color: t.MUTED }}>
        <Tag size={20} />
      </div>
      <PluginRailFooter />
    </aside>
  );
}
