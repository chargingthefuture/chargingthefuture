'use client';

import { useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { useDailyExchangeReading } from '@/components/engagement/daily-exchange-section';
import { getContributorAccessTokens } from './contributor-access-shared';
import { ContributorAccessAdminSections } from './contributor-access-admin-sections';
import { WeaversBadge } from './weavers-badge';

// The Weavers of the Commons admin page, /admin/weavers. It sat inside the Daily exchange section of
// the Adoption screen until 2026-11-24 (owner decision): the badge scores the same events as the
// day's count, but it is not the same data. The day's reading is still read here, only for the event
// list, so the weights editor marks the badge-only events and lists them in the same order.
export function WeaversAdminShell() {
  const { theme } = useTheme();
  const t = getContributorAccessTokens(theme);
  const { reading, reload } = useDailyExchangeReading();

  const badgeOnlyKeys = useMemo(
    () => new Set((reading?.events ?? []).filter((event) => !event.delivers).map((event) => event.key)),
    [reading],
  );
  const weightOrder = useMemo(() => (reading?.events ?? []).map((event) => event.key), [reading]);

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader title="Weavers of the Commons" accent={t.ACCENT} icon={<WeaversBadge size={18} />} backHref="/admin" />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 40px' }}>
        <ContributorAccessAdminSections badgeOnlyKeys={badgeOnlyKeys} weightOrder={weightOrder} onConfigSaved={reload} />
      </div>
    </div>
  );
}
