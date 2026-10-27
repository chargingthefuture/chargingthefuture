'use client';

import { useState } from 'react';
import { ChevronDown, LogIn, TrendingUp } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import { DailyExchangeSection, useDailyExchangeReading } from '@/components/engagement/daily-exchange-section';
import { WeeklyPerformanceSection } from '@/components/weekly-performance/weekly-performance-section';
import { WeeklyPerformanceSignInRecordSection } from '@/components/weekly-performance/wp-sign-in-record-section';
import { AdoptionSteps } from './adoption-steps';
import { AdoptionMeasures } from './adoption-measures';

// Adoption: every admin reading of whether members are working with each other, on one screen
// (owner decision, 2026-10-16). The steps toward 384 sit on top, then Days won and retention (3.1),
// then the daily exchange and the Weavers badge, then Weekly Performance, then the sign-in record
// behind its Active Members rows.
// These were three separate admin screens before.
export function AdoptionShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('service-credits', theme), theme);
  const { reading, error, reload } = useDailyExchangeReading();
  // Folded shut until asked for: reading the record writes the admin's own sign-in, so it must not
  // run on every visit to this screen.
  const [signInOpen, setSignInOpen] = useState(false);

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

        <DailyExchangeSection reading={reading} error={error} onReload={reload} />

        <div style={{ marginTop: 32 }}>
          <WeeklyPerformanceSection />
        </div>

        <section style={{ marginTop: 32 }}>
          <button
            type="button"
            aria-expanded={signInOpen}
            onClick={() => setSignInOpen((open) => !open)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              background: t.SURFACE,
              border: `1px solid ${t.BORDER}`,
              borderRadius: 12,
              padding: '12px 14px',
              color: t.TITLE,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <LogIn size={16} color={t.ACCENT} />
            <span style={{ flex: 1 }}>Sign-in record</span>
            <ChevronDown
              size={16}
              color={t.SUBTLE}
              style={{ transform: signInOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            />
          </button>
          {signInOpen && (
            <div style={{ marginTop: 12 }}>
              <WeeklyPerformanceSignInRecordSection />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
