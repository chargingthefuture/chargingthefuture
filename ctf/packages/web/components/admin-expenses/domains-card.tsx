'use client';

import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { formatDollars } from 'lib/admin-expenses/summary';
import { DOMAINS, domainsByNextRenewal, domainsYearlyCents, formatRenewal } from 'lib/admin-expenses/domains';

// Every domain name with its yearly price and the month and day it renews, soonest renewal first.
export function DomainsCard({ tokens: t, today }: { tokens: PluginShellTokens; today: string }) {
  const yearly = domainsYearlyCents(DOMAINS);
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: t.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>
        Domains, renewed yearly
      </h2>
      <div style={{ padding: 12, borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
        <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 8 }}>
          {formatDollars(yearly)} a year, {formatDollars(yearly / 12)} a month. Not in the monthly total.
        </div>
        {domainsByNextRenewal(DOMAINS, today).map((domain) => (
          <div key={domain.name} style={{ padding: '6px 0', borderTop: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{domain.name}</span>
              <span style={{ fontSize: 13, color: t.TITLE, whiteSpace: 'nowrap' }}>{formatDollars(domain.yearlyCents)}</span>
              <span style={{ fontSize: 12, color: t.MUTED, whiteSpace: 'nowrap', minWidth: 56, textAlign: 'right' }}>{formatRenewal(domain.renews)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
