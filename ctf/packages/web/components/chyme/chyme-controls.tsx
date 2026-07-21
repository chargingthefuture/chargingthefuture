'use client';

import type { CSSProperties } from 'react';
import { Hand, Mic, MicOff, Phone, Volume2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens, type ChymeTokens } from './chyme-shared';

function toggleButtonStyle(t: ChymeTokens, active: boolean, activeBg: string, activeBorder: string, activeColor: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 12,
    background: active ? activeBg : t.INPUT_BG,
    border: `1px solid ${active ? activeBorder : t.BORDER_STRONG}`,
    color: active ? activeColor : t.SUBTLE,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

export function ChymeControls({
  muted,
  onToggleMute,
  handRaised,
  onToggleHand,
  joinReady,
  onLeave,
}: {
  muted: boolean;
  onToggleMute: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
  joinReady: boolean;
  onLeave: () => void;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const muteStyle = muted
    ? toggleButtonStyle(t, true, 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0.4)', '#F87171')
    : toggleButtonStyle(t, true, `${t.ACCENT}18`, `${t.ACCENT}40`, t.ACCENT);
  const handStyle = toggleButtonStyle(t, handRaised, 'rgba(234,179,8,0.15)', 'rgba(234,179,8,0.4)', '#FDE047');

  return (
    <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.BORDER}`, background: t.HEADER, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
      <button onClick={onToggleMute} style={muteStyle}>
        {muted ? <MicOff size={16} /> : <Mic size={16} />}
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <button onClick={onToggleHand} style={handStyle}>
        <Hand size={16} />
        {handRaised ? 'Lower Hand' : 'Raise Hand'}
      </button>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 12, color: t.FAINT, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Volume2 size={14} /> Audio
      </div>
      {joinReady && (
        <button
          onClick={onLeave}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <Phone size={16} /> Leave
        </button>
      )}
    </div>
  );
}
