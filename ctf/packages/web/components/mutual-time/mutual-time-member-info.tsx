'use client';

import { CalendarClock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getMutualTimeTokens } from './mutual-time-shared';

// What an approved (non-admin) member sees at /apps/mutual-time. Mutual Time events are shared as a
// direct link, so there is no event list here — this panel just explains how it works and that the
// link they were given is where they vote.
export function MutualTimeMemberInfo() {
  const { theme } = useTheme();
  const t = getMutualTimeTokens(theme);
  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TITLE }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <CalendarClock size={22} style={{ color: t.ACCENT }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Mutual Time</h1>
        </div>
        <p style={{ color: t.SUBTLE, fontSize: 14, marginTop: 4 }}>Find a meeting time everyone can make.</p>
        <div style={{ marginTop: 20, borderRadius: 14, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, padding: 24, fontSize: 14, color: t.SUBTLE, lineHeight: 1.6 }}>
          Mutual Time events are shared with you as a direct link. Open the link you were given to pick the
          times you&apos;re free — in your own timezone — and the app chooses the slot the most people can
          make. When a time is chosen, the same link shows it and where the meeting happens.
        </div>
      </div>
    </div>
  );
}
