'use client';

import { useState } from 'react';
import { Radio } from 'lucide-react';
import { BackChevronButton } from '@/lib/nav/back-history';
import { useTheme } from '@/hooks/useTheme';
import { ChymeLiveShell, type ChymeRoomScope } from '@/components/chyme/chyme-live-shell';
import { WeaversBadge } from '@/components/contributor-access/weavers-badge';
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
  // Which room the shell is showing. The private "Weavers of the Commons" room is switched to here;
  // ChymeLiveShell is keyed by scope so a switch remounts it cleanly for the new room.
  const [roomScope, setRoomScope] = useState<ChymeRoomScope>('main');

  // The two room tabs. The Weavers tab is shown to everyone (no-shaming): a member who is not eligible
  // simply sees the "how it's earned" explainer when they open it, never a locked/absence state.
  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? t.ACCENT_TINT_40 : t.BORDER}`,
    background: active ? t.ACCENT_TINT_15 : 'transparent',
    color: active ? t.ACCENT : t.SUBTLE,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  // The compact top bar (back + brand) is pinned with position:sticky, and the page below flows
  // naturally. The chat message list is capped (see chyme-chat-panel) so incoming messages scroll
  // inside the chat window instead of stretching the document — without a hard viewport lock that
  // clipped the chat's input off the bottom of the screen on phones.
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

        {/* Room switcher: the open main room and the private Weavers room. */}
        <div
          role="tablist"
          aria-label="Chyme rooms"
          style={{ display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto', borderBottom: `1px solid ${t.BORDER}`, background: t.HEADER }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={roomScope === 'main'}
            style={tabStyle(roomScope === 'main')}
            onClick={() => setRoomScope('main')}
          >
            Main Room
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={roomScope === 'contributors'}
            style={tabStyle(roomScope === 'contributors')}
            onClick={() => setRoomScope('contributors')}
          >
            <WeaversBadge size={16} />
            Weavers of the Commons
          </button>
        </div>

        <ChymeLiveShell key={roomScope} currentUser={currentUser} roomScope={roomScope} />
      </div>
    );
}
