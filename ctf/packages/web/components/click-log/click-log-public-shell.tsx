'use client';

import { AlertTriangle, Lock, ShieldCheck, Clock, FileText, UserPlus, Eye, EyeOff, Pointer, MapPin } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { useTheme } from '@/hooks/useTheme';
import { getClickLogTokens } from './click-log-shared';

// Palette from the ClickLogPublic / MobileClickLogPublic design mockups, now sourced from the
// theme-aware ClickLog tokens (default theme keeps the shipped hex values).

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

function DesktopClickLogPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getClickLogTokens(theme);
  return (
    // ctf-self-responsive opts this flex column out of the global small-screen "un-row" fallback
    // (.ctf-app-viewport > * → display:block on phones), which would otherwise collapse the column
    // and stop flex:1 from pushing the bottom nav to the bottom.
    <div className="ctf-self-responsive" style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <PublicShellBackLink />
        <AlertTriangle size={18} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>ClickLog</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.BORDER, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                Sign In
              </a>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <UserPlus size={13} /> Join Free
              </a>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 64px' }}>
        <div style={{ maxWidth: 600, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
          {/* Locked button */}
          <div style={{ position: 'relative' }}>
            <div style={{ width: 160, height: 160, borderRadius: '50%', background: 'rgba(233,30,140,0.1)', border: '4px solid rgba(233,30,140,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, filter: 'blur(2px)', opacity: 0.5 }}>
              <AlertTriangle size={40} style={{ color: t.ACCENT }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: t.ACCENT }}>Log Incident</span>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(233,30,140,0.15)', border: `2px solid ${t.ACCENT}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={22} color={t.ACCENT} />
              </div>
            </div>
          </div>

          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, lineHeight: 1.2, marginBottom: 12 }}>
              Track incidents privately.<br />
              <span style={{ color: t.ACCENT }}>Sign in to start.</span>
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: t.MUTED, lineHeight: 1.7, maxWidth: 440 }}>
              One tap to log a personal safety incident. Add notes, attach location, and keep a private history — only visible to you.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {verifyUrl ? (
              <a href={verifyUrl} style={{ padding: '14px 32px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
                Finish verifying
              </a>
            ) : (
              <>
                <a href={signInUrl} style={{ padding: '14px 32px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
                  Create free account
                </a>
                <a href={signInUrl} style={{ padding: '14px 24px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1px solid ${t.BORDER_SOLID}`, color: t.SUBTLE, fontSize: 15, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                  Sign In
                </a>
              </>
            )}
          </div>

          {/* Features */}
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            {[
              { Icon: Eye, label: 'Private by default', desc: 'No one else can see your logs — ever.' },
              { Icon: ShieldCheck, label: 'Private', desc: 'Only you can see your incidents.' },
              { Icon: EyeOff, label: 'Discreet logging', desc: 'One tap — no visible confirmation needed.' },
            ].map(({ Icon, label, desc }) => (
              <div key={label} style={{ flex: 1, padding: '14px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, textAlign: 'center' }}>
                <Icon size={20} color={t.ACCENT} style={{ marginBottom: 8, opacity: 0.7 }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileClickLogPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getClickLogTokens(theme);
  return (
    // ctf-self-responsive: keep this a real flex column on phones so the middle (flex:1) pushes the
    // locked bottom nav to the bottom edge. Without it the global mobile un-row rule forces
    // display:block and the nav floats mid-screen with empty space beneath it.
    <div className="ctf-self-responsive" style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: `${t.ACCENT}10`, borderBottom: `1px solid ${t.ACCENT}25`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PublicShellBackLink />
            <AlertTriangle size={18} color={t.ACCENT} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>ClickLog</div>
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 24px', textAlign: 'center', gap: 22 }}>
        {/* Locked button */}
        <div style={{ position: 'relative' }}>
          <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'rgba(233,30,140,0.1)', border: '3px solid rgba(233,30,140,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'blur(2px)', opacity: 0.5 }}>
            <AlertTriangle size={40} color={t.ACCENT} />
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(233,30,140,0.12)', border: `2px solid ${t.ACCENT}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color={t.ACCENT} />
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 8 }}>
            Track incidents privately
          </div>
          <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, maxWidth: 290 }}>
            Sign in to start logging personal safety incidents — one tap, private.
          </div>
        </div>

        <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '14px', borderRadius: 12, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', textDecoration: 'none' }}>
          {verifyUrl ? 'Finish verifying' : <><UserPlus size={15} /> Create free account</>}
        </a>

        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          {[
            { Icon: Pointer, label: 'One tap' },
            { Icon: ShieldCheck, label: 'Private' },
            { Icon: MapPin, label: 'Location' },
          ].map(({ Icon, label }) => (
            <div key={label} style={{ flex: 1, padding: '12px 8px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, textAlign: 'center' }}>
              <Icon size={18} color={t.ACCENT} style={{ marginBottom: 6, opacity: 0.75 }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: t.MUTED }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav (locked) */}
      <div style={{ height: 72, background: t.RAIL, borderTop: `1px solid ${t.BORDER_SOLID}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexShrink: 0 }}>
        {[AlertTriangle, Clock, FileText].map((Icon, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.3 }}>
            <Icon size={20} color={t.MUTED} />
            <span style={{ fontSize: 10, color: t.MUTED }}>{['Log', 'History', 'Export'][i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for ClickLog. Pixel-faithful to the ClickLogPublic
 * (desktop) and MobileClickLogPublic (phone) design mockups, with sign-in
 * affordances pointing at the real hosted sign-in URL. It shows no private or
 * per-user data — the whole point of ClickLog is a private, per-user incident
 * log, so the visitor view is marketing copy and a locked "Log Incident" button
 * only. The mockup's simulated phone status bar (clock / signal dots) is dropped
 * because the real app renders inside the browser chrome.
 */
export function ClickLogPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileClickLogPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopClickLogPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
