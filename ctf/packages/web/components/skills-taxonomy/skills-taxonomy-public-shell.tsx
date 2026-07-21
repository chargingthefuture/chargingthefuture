'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Lock, ChevronRight, UserPlus } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getSkillsTaxonomyTokens } from './st-shared';

// Palette from the SkillsTaxonomyPublic / MobileSkillsTaxonomyPublic mockups, resolved through the
// theme-aware Skills Taxonomy tokens (default theme keeps the shipped hex values).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

type TaxonomyCounts = { skills: number; jobTitles: number; sectors: number };

// Live public teaser counts (sectors / job titles / skills) from the unauthenticated summary endpoint.
// Best-effort: while loading or on failure, `null` is returned and the UI falls back to neutral phrasing
// rather than showing zeros or invented numbers. The counts are read live from the tables, so adding a
// skill or job title is reflected here on the next visit.
function useTaxonomySummary(): TaxonomyCounts | null {
  const [counts, setCounts] = useState<TaxonomyCounts | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/skills-taxonomy/summary');
        if (!res.ok) return;
        const data = (await res.json()) as Partial<TaxonomyCounts>;
        if (
          !cancelled
          && typeof data.skills === 'number'
          && typeof data.jobTitles === 'number'
          && typeof data.sectors === 'number'
        ) {
          setCounts({ skills: data.skills, jobTitles: data.jobTitles, sectors: data.sectors });
        }
      } catch {
        // Teaser counts are non-essential; keep the neutral phrasing on any failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return counts;
}

function StatTriplet({ counts, fontSize }: { counts: TaxonomyCounts; fontSize: number }) {
  const { theme } = useTheme();
  const t = getSkillsTaxonomyTokens(theme);
  const items: Array<[number, string]> = [
    [counts.skills, 'Skills'],
    [counts.jobTitles, 'Job Titles'],
    [counts.sectors, 'Sectors'],
  ];
  return (
    <div style={{ display: 'flex', gap: 28 }}>
      {items.map(([n, label]) => (
        <div key={label}>
          <div style={{ fontSize, fontWeight: 800, color: t.ACCENT, lineHeight: 1.1 }}>{n.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: t.MUTED }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function MobileSkillsTaxonomyPublic({ signInUrl, verifyUrl, counts }: { signInUrl: string; verifyUrl?: string; counts: TaxonomyCounts | null }) {
  const { theme } = useTheme();
  const t = getSkillsTaxonomyTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 12px', background: `${t.ACCENT}10`, borderBottom: `1px solid ${t.ACCENT}25`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PublicShellBackLink />
            <BookOpen size={18} color={t.ACCENT} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>Skills Taxonomy</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {verifyUrl ? (
              <a href={verifyUrl} style={{ padding: '5px 10px', borderRadius: 6, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Finish verifying</a>
            ) : (
              <>
                <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: t.BORDER_STRONG, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
                <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Join Free</a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero copy */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 8 }}>
          Explore the survivor skills database
        </div>
        <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, marginBottom: 16 }}>
          Every skill, job title, and sector represented by survivors. Sign in to search, filter, and trade with survivors who have the skills you need.
        </div>
        {counts ? (
          <div style={{ marginBottom: 16 }}>
            <StatTriplet counts={counts} fontSize={22} />
          </div>
        ) : null}
        <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '13px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', marginBottom: 16, textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : <><UserPlus size={15} /> Create free account</>}
        </a>
      </div>

      {/* Blurred sector list + lock overlay (neutral placeholders) */}
      <div style={{ padding: '0 16px 32px', position: 'relative' }}>
        <div style={{ filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.4 }} aria-hidden="true">
          <div style={{ fontSize: 12, fontWeight: 700, color: t.MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>All Sectors</div>
          {['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'].map((dot, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
              <div style={{ height: 12, width: 130, borderRadius: 6, background: t.BORDER_STRONG, flex: 1 }} />
              <ChevronRight size={14} color={t.MUTED} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${t.ACCENT}50`, background: `${t.ACCENT}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={20} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to explore</div>
          <div style={{ fontSize: 12, color: t.MUTED, textAlign: 'center', maxWidth: 240 }}>
            Full access to all sectors, job titles, and skills requires an account.
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Skills Taxonomy. Pixel-faithful to the
 * SkillsTaxonomyPublic (desktop) and MobileSkillsTaxonomyPublic (phone) design
 * mockups, with every sign-in affordance pointing at the real hosted sign-in URL.
 *
 * The mockup's aggregate counts (the hero pill, the stat triplet) are now LIVE: they come from the
 * public, unauthenticated `/api/skills-taxonomy/summary` endpoint, which returns only counts of active
 * sectors / job titles / skills (no taxonomy rows, no member data). The mockup's literal 128 / 47 / 9
 * were sample figures — these update automatically as the taxonomy grows. While the counts load (or if
 * the fetch fails) the hero pill falls back to neutral phrasing and the triplet is hidden, so nothing
 * shows zeros or invented numbers. The blurred sector/job-title preview behind the sign-in lock stays
 * neutral placeholder cards (no invented taxonomy rows). The simulated phone status bar is dropped
 * because the real app renders inside the browser chrome.
 */
export function SkillsTaxonomyPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const counts = useTaxonomySummary();
  return <MobileSkillsTaxonomyPublic signInUrl={signInUrl} verifyUrl={verifyUrl} counts={counts} />;
}
