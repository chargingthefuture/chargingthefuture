'use client';

import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';

// "Demo data" on a sign-up row: switches the account to the demo schema (public.demo_mode_accounts),
// beside the "Mark as demo / test" control that only changes what the counts include.
export function UnlockSignupDemo({
  userId,
  demoData,
  busy,
  onToggleDemo,
}: {
  userId: string;
  demoData: boolean;
  busy: boolean;
  onToggleDemo: (userId: string, demo: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);

  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        role="switch"
        aria-checked={demoData}
        onClick={() => onToggleDemo(userId, !demoData)}
        disabled={busy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 8,
          background: demoData ? 'rgba(245,158,11,0.15)' : t.SURFACE_CARD,
          border: `1px solid ${demoData ? 'rgba(245,158,11,0.5)' : t.BORDER_SOLID}`,
          color: demoData ? '#F59E0B' : t.MUTED,
          fontSize: 12,
          fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        Demo data: {demoData ? 'on' : 'off'}
      </button>
      <span style={{ fontSize: 11, color: t.MUTED }}>
        {demoData ? 'This account sees demo data on every screen.' : 'This account sees real data.'}
      </span>
    </div>
  );
}
