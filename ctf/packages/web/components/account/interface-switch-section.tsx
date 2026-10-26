'use client';

import type { CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';
import type { getAccountDataTokens } from '@/components/account-data/account-data-shared';
import { useInterfaceSwitch } from '@/components/se-frame/use-interface-switch';

// Settings on the account page: the switch into 3.1, the social redesign. The way back to 3.0 is on
// the Me tab inside 3.1.
export function InterfaceSwitchSection({
  tok,
  cardStyle,
  sectionLabel,
}: {
  tok: ReturnType<typeof getAccountDataTokens>;
  cardStyle: CSSProperties;
  sectionLabel: CSSProperties;
}) {
  const { switchTo, saving, error } = useInterfaceSwitch();
  return (
    <section style={cardStyle}>
      <div style={sectionLabel}>Settings</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 4px' }}>
        <span style={{ color: tok.BRAND, flexShrink: 0, display: 'flex' }}>
          <Sparkles size={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>Try Skills Economy 3.1</span>
          <span style={{ display: 'block', fontSize: 12, color: tok.SUBTLE, lineHeight: 1.5 }}>
            The new look is still being built. You can go back to 3.0 at any time from the Me tab.
          </span>
          <button
            type="button"
            onClick={() => void switchTo('3.1')}
            disabled={saving}
            style={{
              marginTop: 10,
              minHeight: 44,
              padding: '0 16px',
              borderRadius: 999,
              border: `1px solid ${tok.BORDER}`,
              background: tok.SURFACE,
              color: tok.TEXT,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Switching…' : 'Switch to 3.1'}
          </button>
          {error ? (
            <span role="alert" style={{ display: 'block', marginTop: 8, fontSize: 12, color: tok.TEXT }}>
              {error}
            </span>
          ) : null}
        </span>
      </div>
    </section>
  );
}
