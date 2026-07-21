'use client';

import { Radio } from 'lucide-react';
import { BackChevronButton } from '@/lib/nav/back-history';
import { useTheme } from '@/hooks/useTheme';
import { ChymeLiveShell } from '@/components/chyme/chyme-live-shell';
import { MobileTopActions } from '@/components/shared/mobile-top-actions';
import { getChymeTokens } from './chyme-shared';

type ChymeShellProps = {
  currentUser: {
    userId: string;
    username: string | null;
  };
};

export function ChymeShell({ currentUser }: ChymeShellProps) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);

  // Phones: drop the 72px side rail for a compact sticky top bar (back + brand)
  // and let the live shell fill the width and stack its panes vertically.
  return (
      <div style={{ minHeight: '100dvh', background: t.BG }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <BackChevronButton accent={t.ACCENT} />
          <div style={{ width: 32, height: 32, borderRadius: 9, background: t.ACCENT_TINT_15, border: `1px solid ${t.ACCENT_TINT_40}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ACCENT, flexShrink: 0 }}>
            <Radio size={18} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Chyme</span>
          <MobileTopActions />
        </div>
        <ChymeLiveShell currentUser={currentUser} />
      </div>
    );
}
