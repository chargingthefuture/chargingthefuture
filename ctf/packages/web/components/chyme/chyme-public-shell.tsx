'use client';

import { Radio, Lock, LogIn, UserPlus, Search } from 'lucide-react';
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

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function ChymePublicView({ signInUrl, verifyUrl, live }: { signInUrl: string; verifyUrl?: string; live: LiveState }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    // The page itself scrolls — the shell is only *at least* one viewport tall and nothing inside it
    // owns a scrollbar. Pinned to exactly 100dvh with an inner scrolling box, the document never
    // scrolls, and Safari's "Full Page" screenshot has nothing to extend past the first viewport.
    // The header keeps its shipped always-visible behavior via position: sticky.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${t.ACCENT} 0%, ${ACCENT_CYAN} 100%)`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
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
      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
 * experience pixel-faithful to the MobileChymePublic (phone) design mockup — the one layout the
 * app ships at every width — with sign-in affordances pointing at the real hosted
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

  // One layout at every width (mobile-first, owner decision 2026-07-20): the desktop two-column
  // branch this file used to carry was hidden by CSS at every width, so it never rendered.
  // `ctf-self-responsive` opts this wrapper out of the small-screen un-row fallback so the phone
  // layout below manages its own flex column.
  return (
    <div className="ctf-self-responsive">
      <ChymePublicView signInUrl={signInUrl} verifyUrl={verifyUrl} live={live} />
    </div>
  );
}
