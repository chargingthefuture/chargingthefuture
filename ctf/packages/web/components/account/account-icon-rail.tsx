'use client';

import { Shield } from 'lucide-react';
import { PluginRailFooter } from '@/components/shared/plugin-rail-footer';

// The uniform left icon rail for the account area (Your account, Data & privacy, Blocked members).
// It carries the same shape every plugin rail has — a brand mark on top and the shared footer at the
// bottom (back, account & settings, account menu) — so the account screens stop being the odd ones
// out with no rail. The footer's back resolves one level up via the shared policy: an account
// sub-page goes to the account hub, the hub goes to all apps.
export function AccountIconRail({ brand, bg, border }: { brand: string; bg: string; border: string }) {
  return (
    <aside
      style={{
        width: 72,
        background: bg,
        borderRight: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 16,
        gap: 8,
        flexShrink: 0,
      }}
    >
      <div
        style={{ width: 40, height: 40, borderRadius: 12, background: `${brand}25`, border: `1px solid ${brand}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}
        aria-hidden="true"
      >
        <Shield size={20} color={brand} />
      </div>
      <PluginRailFooter />
    </aside>
  );
}
