'use client';

import { Radio, RefreshCw } from 'lucide-react';
import { BORDER, PRIMARY } from './chyme-shared';

export function ChymeHeader({
  participantCount,
  isLive,
  onRefresh,
}: {
  participantCount: number;
  isLive: boolean;
  onRefresh: () => void;
}) {
  return (
    <header style={{ height: 60, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#030d05', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${PRIMARY}25`, border: `1px solid ${PRIMARY}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Radio size={18} style={{ color: PRIMARY }} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#F0FDF4' }}>Chyme 🎙️</div>
          <div style={{ fontSize: 12, color: '#16A34A' }}>Social Audio</div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {isLive && (
        <span style={{ background: `${PRIMARY}15`, color: PRIMARY, border: `1px solid ${PRIMARY}30`, fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
          🔴 Live
        </span>
      )}
      <span style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
        {participantCount} Participants
      </span>
      <button
        onClick={onRefresh}
        style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}
        title="Refresh messages"
      >
        <RefreshCw size={16} />
      </button>
    </header>
  );
}
