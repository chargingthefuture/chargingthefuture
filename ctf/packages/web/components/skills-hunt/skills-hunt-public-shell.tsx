'use client';

import { Search, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';

// Palette from the SkillsHuntPublic / MobileSkillsHuntPublic design mockups.
const BG = '#0F1117';
const COLOR = '#FBBF24';
const TEXT = '#F9FAFB';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Static description of how SkillsHunt works (marketing copy, not user data).
const HOW_IT_WORKS = [
  {
    step: '1',
    icon: '👤',
    title: 'Someone you believe may be a survivor',
    desc: "You don't need to be 100% certain — your best judgment is enough.",
  },
  {
    step: '2',
    icon: '🔗',
    title: 'Enter their info',
    desc: 'First name, bio, Quora profile for social proof, skills, and claimed professions.',
  },
  {
    step: '3',
    icon: '⚡',
    title: 'They join our economy',
    desc: 'Their skills become tradeable in the network. We build self-sufficient pathways.',
  },
  {
    step: '4',
    icon: '🏆',
    title: 'You earn points',
    desc: 'Climb the leaderboard. Earn badges. Find hidden gems.',
  },
];

const NOMINATE_FIELDS = ['First Name', 'Bio', 'Quora Profile URL', 'Skills', 'Claimed Professions'];

function DesktopSkillsHuntPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <Search size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>SkillsHunt</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
              Sign In
            </a>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '48px 64px 32px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
            Gamified talent scouting
          </span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>
            Help find 5 million survivors<br />
            <span style={{ color: COLOR }}>and map their hidden talents</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 520, lineHeight: 1.7 }}>
            This is not a referral button. You nominate someone you believe may be a survivor — entering their first name, bio, Quora profile, skills, and claimed professions. Their profile seeds the Directory so we can trade and stop depending on traffickers for basic needs.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <a href={verifyUrl ?? signInUrl} style={{ padding: '14px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
              {verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}
            </a>
          </div>
        </div>

        {/* How it works */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div style={{ padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${COLOR}20` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 14 }}>How SkillsHunt works</div>
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EAF0', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Blurred form + leaderboard preview behind a sign-in lock (neutral placeholders, no fabricated scouts) */}
      <div style={{ padding: '0 64px 48px', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 16, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          {/* Blurred form */}
          <div style={{ flex: 1, maxWidth: 420, padding: '20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Nominate a Survivor</div>
            {NOMINATE_FIELDS.map((f) => (
              <div key={f} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{f}</div>
                <div style={{ height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
            ))}
            <div style={{ height: 46, borderRadius: 10, background: COLOR + '50' }} />
          </div>
          {/* Blurred leaderboard (neutral placeholder rows) */}
          <div style={{ flex: 1, padding: '20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Scout Leaderboard</div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: 24, fontSize: 16 }}>{['🥇', '🥈', '🥉', '#4'][i]}</div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: COLOR + '30' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 12, width: '55%', borderRadius: 6, background: 'rgba(255,255,255,0.10)', marginBottom: 6 }} />
                  <div style={{ height: 9, width: '40%', borderRadius: 5, background: 'rgba(255,255,255,0.05)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={COLOR} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Join to start scouting</div>
          <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 320 }}>
            Survivors only. Sign in to nominate people you believe may be survivors and help grow our self-sustaining economy.
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '12px 28px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : 'Sign in to scout'}
          </a>
        </div>
      </div>
    </div>
  );
}

function MobileSkillsHuntPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <PublicShellBackLink />
        <Search size={20} color={COLOR} />
        <span style={{ fontSize: 20, fontWeight: 800 }}>SkillsHunt</span>
      </div>

      {/* Hero */}
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600, width: 'fit-content' }}>Community-powered talent scouting</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
          Help find 5M survivors<br />
          <span style={{ color: COLOR }}>&amp; map their skills</span>
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
          This is not a referral button. You nominate someone you believe may be a survivor — first name, bio, Quora profile, skills, and professions. Their profile seeds the Directory so we can trade and stop depending on traffickers.
        </p>

        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      {/* Blurred form preview + lock (neutral placeholders) */}
      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.4 }} aria-hidden="true">
          <div style={{ fontSize: 14, fontWeight: 700 }}>Nominate a Survivor</div>
          {NOMINATE_FIELDS.map((f) => (
            <div key={f}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{f}</div>
              <div style={{ height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
          ))}
          <div style={{ height: 46, borderRadius: 12, background: COLOR + '60' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={20} color={COLOR} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Join to start scouting</div>
          <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>Survivors only. Nominate people you believe may be survivors and help build our self-sustaining economy.</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '11px 28px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in to scout'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for SkillsHunt. Pixel-faithful to the SkillsHuntPublic
 * (desktop) and MobileSkillsHuntPublic (phone) design mockups, with every sign-in
 * affordance pointing at the real hosted sign-in URL.
 *
 * Real-data-only deviations from the mockup (no session = no private/fabricated
 * data): the mockup's hero activity counters (247 found this week, 1,482 skills
 * mapped, 63 scouts active) and the named scout leaderboard rows (Amara O.,
 * Maria G., Priya S., DeShawn W. with survivor counts) are invented sample data,
 * so the counters are dropped and the leaderboard renders neutral blurred
 * placeholder rows behind the sign-in lock. The "Nominate a Survivor" form posts
 * to an authenticated-only endpoint, so its blurred preview stays decorative and
 * its calls to action point at the sign-in URL. The simulated phone status bar is
 * dropped because the real app renders inside the browser chrome.
 */
export function SkillsHuntPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileSkillsHuntPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopSkillsHuntPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
