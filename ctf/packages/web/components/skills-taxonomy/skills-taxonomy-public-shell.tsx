'use client';

import { BookOpen, Lock, ChevronRight, UserPlus, LogIn } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the SkillsTaxonomyPublic / MobileSkillsTaxonomyPublic mockups.
const BRAND = '#818CF8';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Static marketing copy describing why the taxonomy matters (not user data).
const WHY_JOIN = [
  { icon: '⚡', t: 'Trade with anyone', d: 'Skills map to real services you can buy or sell.' },
  { icon: '🎓', t: 'Find learning cohorts', d: 'LevelUp matches you with peers based on shared skills.' },
  { icon: '🔍', t: 'SkillsHunt discovery', d: 'Scouts use this database to nominate and verify survivors.' },
  { icon: '🗺️', t: 'GDP contribution', d: 'Each skill added grows the survivor-economy estimate.' },
];

function DesktopSkillsTaxonomyPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <BookOpen size={18} color={BRAND} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Skills Taxonomy</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '7px 16px', borderRadius: 8, background: BRAND, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <LogIn size={13} /> Sign In
              </a>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: BRAND, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <UserPlus size={13} /> Join Free
              </a>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '48px 64px 32px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, fontSize: 12, color: BRAND, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
            Skills · sectors · job titles
          </span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>
            The survivor skills database<br />
            <span style={{ color: BRAND }}>is yours to explore</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 500, lineHeight: 1.7 }}>
            Browse every skill, job title, and sector represented by survivors worldwide. Sign in to search, filter, and match skills to real opportunities.
          </p>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '14px 32px', borderRadius: 10, background: BRAND, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: 'fit-content', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : <>Sign in to explore <ChevronRight size={16} /></>}
          </a>
        </div>

        {/* Why join */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ padding: '20px', borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND, marginBottom: 14 }}>Why the taxonomy matters</div>
            {WHY_JOIN.map((item) => (
              <div key={item.t} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{item.t}</div>
                  <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5 }}>{item.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Blurred taxonomy preview + lock overlay (neutral placeholders, no fabricated sector data) */}
      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 16, filter: 'blur(5px)', pointerEvents: 'none', opacity: 0.45 }} aria-hidden="true">
          {[0, 1, 2].map((col) => (
            <div key={col} style={{ flex: 1, padding: '16px', borderRadius: 14, border: `1px solid ${BRAND}25`, background: SURFACE }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: BRAND }} />
                <div style={{ height: 12, width: 90, borderRadius: 6, background: 'rgba(255,255,255,0.10)' }} />
              </div>
              {[0, 1, 2].map((row) => (
                <div key={row} style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, marginBottom: 6 }}>
                  <div style={{ height: 11, width: '70%', borderRadius: 5, background: 'rgba(255,255,255,0.08)' }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {[0, 1, 2].map((s) => (
                      <span key={s} style={{ height: 16, width: 42, borderRadius: 10, background: `${BRAND}15`, display: 'inline-block' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${BRAND}50`, background: `${BRAND}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={BRAND} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}>Sign in to explore the full skills database</div>
          <div style={{ fontSize: 13, color: SUBTLE, textAlign: 'center', maxWidth: 340 }}>
            Browse every skill and sector, search by job title, and see which survivors you can trade with.
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '12px 28px', borderRadius: 9, background: BRAND, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Create free account'}
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileSkillsTaxonomyPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 12px', background: `${BRAND}10`, borderBottom: `1px solid ${BRAND}25`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color={BRAND} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>Skills Taxonomy</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {verifyUrl ? (
              <a href={verifyUrl} style={{ padding: '5px 10px', borderRadius: 6, background: BRAND, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Finish verifying</a>
            ) : (
              <>
                <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
                <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: BRAND, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Join Free</a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero copy */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 8 }}>
          Explore the survivor skills database
        </div>
        <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6, marginBottom: 16 }}>
          Every skill, job title, and sector represented by survivors. Sign in to search, filter, and trade with survivors who have the skills you need.
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '13px', borderRadius: 12, background: BRAND, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', marginBottom: 16, textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : <><UserPlus size={15} /> Create free account</>}
        </a>
      </div>

      {/* Blurred sector list + lock overlay (neutral placeholders) */}
      <div style={{ padding: '0 16px 32px', position: 'relative' }}>
        <div style={{ filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.4 }} aria-hidden="true">
          <div style={{ fontSize: 12, fontWeight: 700, color: SUBTLE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>All Sectors</div>
          {['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'].map((dot, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
              <div style={{ height: 12, width: 130, borderRadius: 6, background: 'rgba(255,255,255,0.08)', flex: 1 }} />
              <ChevronRight size={14} color={SUBTLE} />
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${BRAND}50`, background: `${BRAND}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={20} color={BRAND} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to explore</div>
          <div style={{ fontSize: 12, color: SUBTLE, textAlign: 'center', maxWidth: 240 }}>
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
 * Real-data-only deviations from the mockup (no session = no live data): the
 * mockup's exact aggregate counts (128 skills, 47 job titles, 9 sectors), shown
 * in the hero pill, the stat triplet, and the stats strip, are hardcoded sample
 * figures, so they are replaced with neutral phrasing ("Skills · sectors · job
 * titles") rather than fabricated totals. The blurred sector/job-title preview
 * (Technology / Healthcare / Trades with named jobs and "Skill A/B/C" tags, and
 * the six named sector rows) renders as neutral blurred placeholder cards behind
 * the sign-in lock instead of invented taxonomy rows. The simulated phone status
 * bar is dropped because the real app renders inside the browser chrome.
 */
export function SkillsTaxonomyPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileSkillsTaxonomyPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopSkillsTaxonomyPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
