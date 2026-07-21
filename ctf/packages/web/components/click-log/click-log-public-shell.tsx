'use client';

import { AlertTriangle, Lock, ShieldCheck, Clock, FileText, UserPlus, Pointer, MapPin } from 'lucide-react';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { useTheme } from '@/hooks/useTheme';
import { getClickLogTokens } from './click-log-shared';

// Palette from the ClickLogPublic / MobileClickLogPublic design mockups, now sourced from the
// theme-aware ClickLog tokens (default theme keeps the shipped hex values).

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

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
  return <MobileClickLogPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
