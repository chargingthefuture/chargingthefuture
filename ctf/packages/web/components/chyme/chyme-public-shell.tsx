'use client';

import {
  Radio,
  Mic,
  Users,
  Lock,
  LogIn,
  UserPlus,
  Globe,
  ShieldCheck,
  Search,
  Heart,
  Star,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import type { StreamJoinCredentials } from 'lib/chyme/stream';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';
import { ChymeGuestListen } from '@/components/chyme/chyme-guest-listen';

// Live state for the one default public Chyme room, fetched client-side from
// /api/chyme/public/room. `credentials` is present only when the room is live
// and Stream is configured, so a guest can actually listen.
type LiveState = { isLive: boolean; participantCount: number; roomName?: string; credentials?: StreamJoinCredentials };

// Chyme's brand is green. The signed-out (guest) shell must look like the signed-in app, not a
// different purple product — so these mirror the deep-green chrome from chyme-shared (page #04160A,
// card #041a0b, divider #052e16, mint-white title) and the green accent. The old purple/cyan accent
// made the guest view look like a separate app.
// Chrome tokens come from getChymeTokens(theme) (t.BG page, t.BORDER divider, t.TITLE bright
// text, t.MUTED gray, t.ACCENT green). Two values have no token slot and stay static:
const SURFACE = '#041a0b'; // card surface — no getter field matches this hex
const ACCENT_CYAN = '#16A34A'; // deep-green gradient partner — no getter field matches

// Locked participation controls shown on the desktop bottom bar. Each requires a
// signed-in account, so for a visitor they render disabled with a lock glyph.
const LOCKED_CONTROLS = [
  { Icon: Mic, label: 'Speak' },
  { Icon: Heart, label: 'React' },
  { Icon: Star, label: 'Save' },
];

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function DesktopChymePublic({ signInUrl, verifyUrl, live }: { signInUrl: string; verifyUrl?: string; live: LiveState }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, overflow: 'hidden' }}>
      {/* Marketing banner */}
      <div style={{ background: `linear-gradient(90deg, ${t.ACCENT} 0%, ${ACCENT_CYAN} 100%)`, padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PublicShellBackLink />
          <Radio size={15} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Chyme · live audio rooms for the survivor community</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Free to listen · Sign in to speak</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '6px 16px', borderRadius: 7, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '6px 16px', borderRadius: 7, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <LogIn size={13} /> Sign In
              </a>
              <a href={signInUrl} style={{ padding: '6px 16px', borderRadius: 7, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <UserPlus size={13} /> Join Free
              </a>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar — room list */}
        <aside style={{ width: 320, borderRight: `1px solid ${t.BORDER}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 16px 10px', borderBottom: `1px solid ${t.BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Radio size={16} color={t.ACCENT} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>Chyme</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, borderRadius: 20, padding: '3px 10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.ACCENT }} />
                <span style={{ fontSize: 11, color: t.ACCENT, fontWeight: 600 }}>LIVE</span>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.MUTED }} />
              <input placeholder="Search rooms…" style={{ width: '100%', padding: '8px 10px 8px 30px', background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.MUTED, outline: 'none', boxSizing: 'border-box' }} readOnly />
            </div>
          </div>

          <div style={{ padding: '10px 12px 6px', fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Now — Public</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {live.isLive ? (
              <div style={{ borderRadius: 10, border: `1px solid ${t.ACCENT}40`, background: `${t.ACCENT}10`, padding: '14px 16px', margin: '4px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.ACCENT, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>{live.roomName ?? 'Chyme Main Room'}</div>
                  <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>{live.participantCount} listening/on stage</div>
                </div>
              </div>
            ) : (
              <div style={{ borderRadius: 10, border: `1px dashed ${t.BORDER}`, padding: '20px 16px', margin: '4px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 6 }}>No public rooms are streaming right now</div>
                <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>Public rooms appear here when hosts go live. Sign in to start a room or get notified when one opens.</div>
              </div>
            )}
          </div>
        </aside>

        {/* Main — invitation panel */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 32px 16px', borderBottom: `1px solid ${t.BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: SURFACE, border: `1px solid ${t.BORDER}` }}>
                <Globe size={11} color={t.MUTED} /><span style={{ fontSize: 11, color: t.MUTED }}>Public</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: SURFACE, border: `1px solid ${t.BORDER}` }}>
                <ShieldCheck size={11} color={ACCENT_CYAN} /><span style={{ fontSize: 11, color: ACCENT_CYAN }}>Survivor Verified</span>
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, lineHeight: 1.3 }}>Live audio rooms for survivors</div>
            <div style={{ fontSize: 13, color: t.MUTED, marginTop: 4 }}>Listen in to public rooms for free. Sign in to speak, react, or host your own.</div>
          </div>

          {/* Invitation body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {live.credentials ? (
              <div style={{ marginBottom: 16 }}>
                {live.roomName ? <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 2 }}>{live.roomName}</div> : null}
                <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>You&apos;re listening live — sign in to speak.</div>
                <ChymeGuestListen credentials={live.credentials} participantCount={live.participantCount} accent={t.ACCENT} />
              </div>
            ) : null}
            <div style={{ borderRadius: 12, border: `1px solid ${t.ACCENT}25`, background: `${t.ACCENT}08`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={16} color={t.MUTED} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>You&apos;re browsing as a guest</div>
                <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>Public rooms are open to all. Sign in to speak, react, or raise your hand.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {verifyUrl ? (
                  <a href={verifyUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                    Finish verifying
                  </a>
                ) : (
                  <>
                    <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: 'transparent', border: `1px solid ${t.BORDER}`, color: t.MUTED, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                      <LogIn size={12} /> Sign In
                    </a>
                    <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                      <UserPlus size={12} /> Create Account
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom controls — locked for guests */}
          <div style={{ padding: '16px 32px', borderTop: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            {LOCKED_CONTROLS.map(({ Icon, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.BORDER}`, color: t.MUTED, cursor: 'not-allowed', opacity: 0.45 }}>
                <Lock size={11} /><Icon size={14} /><span style={{ fontSize: 13 }}>{label}</span>
              </div>
            ))}
            <a href={verifyUrl ?? signInUrl} style={{ marginLeft: 'auto', padding: '8px 20px', borderRadius: 8, background: `linear-gradient(90deg,${t.ACCENT},${ACCENT_CYAN})`, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              {verifyUrl ? 'Finish verifying' : 'Sign In to Participate →'}
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}

function MobileChymePublic({ signInUrl, verifyUrl, live }: { signInUrl: string; verifyUrl?: string; live: LiveState }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${t.ACCENT} 0%, ${ACCENT_CYAN} 100%)`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <PublicShellBackLink />
        <Radio size={16} color="#fff" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Chyme</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Live audio for survivors</div>
        </div>
        {verifyUrl ? (
          <a href={verifyUrl} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', color: '#fff', fontWeight: 700, fontSize: 11, textDecoration: 'none' }}>
            Finish verifying
          </a>
        ) : (
          <>
            <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              <LogIn size={11} /> Sign In
            </a>
            <a href={signInUrl} style={{ padding: '5px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', color: '#fff', fontWeight: 700, fontSize: 11, textDecoration: 'none' }}>
              Join
            </a>
          </>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.BORDER}`, background: SURFACE, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.MUTED }} />
          <input placeholder="Search rooms…" style={{ width: '100%', padding: '8px 10px 8px 30px', background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.MUTED, outline: 'none', boxSizing: 'border-box' }} readOnly />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
          {['All', 'Healing', 'Economy', 'Housing', 'Legal', 'Skills'].map((tag) => (
            <span key={tag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: `1px solid ${tag === 'All' ? t.ACCENT + '50' : t.BORDER}`, color: tag === 'All' ? t.ACCENT : t.MUTED, background: tag === 'All' ? `${t.ACCENT}10` : 'transparent', whiteSpace: 'nowrap', cursor: 'pointer' }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Invitation card */}
      <div style={{ margin: '10px 12px 0', borderRadius: 14, border: `1px solid ${t.ACCENT}30`, background: `${t.ACCENT}06`, padding: '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, borderRadius: 20, padding: '2px 8px' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.ACCENT }} />
            <span style={{ fontSize: 10, color: t.ACCENT, fontWeight: 700 }}>LIVE AUDIO</span>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>Live audio rooms for survivors</div>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 12, lineHeight: 1.5 }}>Listen in for free. Sign in to speak, react, or host your own room.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ flex: 1, padding: '9px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ flex: 1, padding: '9px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none' }}>
                <UserPlus size={13} /> Join Free to Listen
              </a>
              <a href={signInUrl} style={{ padding: '9px 14px', borderRadius: 9, background: SURFACE, border: `1px solid ${t.BORDER}`, color: t.MUTED, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                <LogIn size={13} /> Sign In
              </a>
            </>
          )}
        </div>
      </div>

      {/* Room list — empty state */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {live.isLive && live.credentials ? (
          <div>
            {live.roomName ? <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 2 }}>{live.roomName}</div> : null}
            <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>You&apos;re listening live — sign in to speak.</div>
            <ChymeGuestListen credentials={live.credentials} participantCount={live.participantCount} accent={t.ACCENT} />
          </div>
        ) : null}
        {!live.isLive ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Rooms</div>
            <div style={{ borderRadius: 10, border: `1px dashed ${t.BORDER}`, padding: '20px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 4 }}>No public rooms right now</div>
              <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>Public rooms show up here when hosts go live. Sign in to start one or get notified.</div>
            </div>
          </>
        ) : null}
      </div>

      {/* Locked bottom bar */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${t.BORDER}`, background: SURFACE, display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, padding: '10px', borderRadius: 9, background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, color: t.MUTED, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'not-allowed', opacity: 0.6 }}>
          <Lock size={12} /> Start a Room
        </div>
        <a href={verifyUrl ?? signInUrl} style={{ flex: 1, padding: '10px', borderRadius: 9, background: `linear-gradient(90deg,${t.ACCENT},${ACCENT_CYAN})`, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : <><UserPlus size={13} /> Join Free →</>}
        </a>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Chyme. Renders the public marketing / empty-state
 * experience pixel-faithful to the ChymePublic (desktop) and MobileChymePublic
 * (phone) design mockups, with sign-in affordances pointing at the real hosted
 * sign-in URL. It shows no private or per-user data: there is no public room
 * feed yet, so the room list renders an honest empty state rather than the
 * mockup's placeholder rooms.
 */
export function ChymePublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  // Fetch the one default public room's live status once on mount. When it is
  // live and Stream is configured, the API returns join credentials so a
  // signed-out visitor can actually listen. Any error is ignored — the guest
  // simply sees the not-live view.
  const [live, setLive] = useState<LiveState>({ isLive: false, participantCount: 0 });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/chyme/public/room', { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.ok) {
          setLive({
            isLive: !!data.isLive,
            participantCount: data.participantCount ?? 0,
            roomName: typeof data.roomName === 'string' ? data.roomName : undefined,
            credentials: data.credentials,
          });
        }
      } catch {
        // Ignore — guest just sees the not-live view.
      }
    })();
    return () => controller.abort();
  }, []);

  // Render both layouts and let CSS pick by the 768px breakpoint, rather than a
  // client `matchMedia` hook. This page is server-rendered for signed-out
  // visitors; a CSS switch is always in lock-step with the breakpoint and needs
  // no hydration, so the phone never gets stuck on the desktop two-column row.
  // `ctf-self-responsive` opts this wrapper out of the small-screen un-row
  // fallback so it manages its own layout.
  return (
    <div className="ctf-self-responsive">
      <div className="ctf-bp-desktop">
        <DesktopChymePublic signInUrl={signInUrl} verifyUrl={verifyUrl} live={live} />
      </div>
      <div className="ctf-bp-mobile">
        <MobileChymePublic signInUrl={signInUrl} verifyUrl={verifyUrl} live={live} />
      </div>
    </div>
  );
}
