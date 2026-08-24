'use client';

// Sticky chrome for the member shell: title row, search, and the Suggest entry point.
// Split out of what-works-shell.tsx to keep that component within the size limits of rule 116.
import { ListChecks, Plus, Search } from 'lucide-react';
import { BackChevronButton } from '@/lib/nav/back-history';
import { PluginAdminButton } from '@/components/shared/plugin-admin-button';
import { MobileTopActions } from '@/components/shared/mobile-top-actions';
import { RefreshButton } from '@/components/shared/refresh-button';
import { useTheme } from '@/hooks/useTheme';
import { getWhatWorksTokens } from './ww-shared';

type Props = {
  isAdmin: boolean;
  query: string;
  onSearch: (next: string) => void;
  onRefresh: () => Promise<void>;
  onSuggest: () => void;
};

export function WhatWorksShellHeader({ isAdmin, query, onSearch, onRefresh, onSuggest }: Props) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
      {/* flexWrap: this row carries the plugin actions plus the three global ones, which
          together overflow a 390px phone — the last control was clipped off the right
          edge and the title collapsed to nothing. Wrapping reflows instead of cutting
          off; on a wider viewport it still renders as one line. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 6, gap: 8, padding: '10px 14px' }}>
        <BackChevronButton accent={t.ACCENT} />
        <ListChecks size={18} color={t.ACCENT} style={{ flexShrink: 0 }} />
        {/* Title shrinks and truncates so the trailing controls stay on screen */}
        <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>What Works</span>
        <PluginAdminButton href="/admin/what-works" isAdmin={isAdmin} accent={t.ACCENT} />
        <RefreshButton onRefresh={onRefresh} title="Refresh" />
        <MobileTopActions />
      </div>
      <div style={{ padding: '0 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}` }}>
          <Search size={14} color={t.MUTED} />
          <input
            aria-label="Search tools or problems"
            value={query}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search tools or problems…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: t.TITLE, fontFamily: 'inherit' }}
          />
        </div>
      </div>
      {/* The Suggest entry point lives in the desktop sidebar; mobile has no sidebar, so add it
          here so a phone user can still add an item to the shared list. */}
      <div style={{ padding: '0 12px 10px' }}>
        <button
          type="button"
          onClick={onSuggest}
          style={{ width: '100%', padding: '10px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          <Plus size={15} /> Suggest an item
        </button>
      </div>
    </div>
  );
}
