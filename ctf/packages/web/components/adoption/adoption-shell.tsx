'use client';

import { LogIn, TrendingUp } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import { DailyExchangeSection, useDailyExchangeReading } from '@/components/engagement/daily-exchange-section';
import { WeeklyPerformanceSignInRecordSection } from '@/components/weekly-performance/wp-sign-in-record-section';
import { AdoptionSteps } from './adoption-steps';
import { AdoptionMeasures } from './adoption-measures';
import { CardFeedbackSection } from './card-feedback-section';

// Adoption: every admin reading of whether members are working with each other, on one screen
// (owner decision, 2026-10-16). The steps toward 384 sit on top, then Days won and retention (3.1),
// then what members finish and pass on in Today, then the sign-in record, then the daily exchange.
// The Weavers badge moved to its own page, /admin/weavers, on 2026-11-24 (owner decision). The
// Weekly Performance section was taken off on 2026-11-23 (owner decision): its routes and the daily
// goal capture still run, with no screen reading them.
export function AdoptionShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('service-credits', theme), theme);
  const { reading, error } = useDailyExchangeReading();

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader
        title="Adoption"
        accent={t.ACCENT}
        icon={<TrendingUp size={18} color={t.ACCENT} />}
        backHref="/admin"
      />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px 40px' }}>
        <AdoptionSteps reading={reading} failed={error !== null} tokens={t} />

        <AdoptionMeasures tokens={t} />

        <CardFeedbackSection tokens={t} />

        <section style={{ marginTop: 32 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: t.TITLE, margin: '0 0 8px' }}>
            <LogIn size={16} color={t.ACCENT} />
            Sign-in record
          </h2>
          {/* Open on arrival (owner decision, 2026-11-23): reading it records the admin's own sign-in for the day. */}
          <WeeklyPerformanceSignInRecordSection />
        </section>

        <div style={{ marginTop: 32 }}>
          <DailyExchangeSection reading={reading} error={error} />
        </div>
      </div>
    </div>
  );
}
