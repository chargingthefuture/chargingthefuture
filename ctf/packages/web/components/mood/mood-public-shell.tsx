'use client';

import { Smile, Shield } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getMoodTokens } from './mood-shared';

// Chrome palette comes from getMoodTokens (default branch = the shipped
// MoodPublic / MobileMoodPublic mockup values).
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

const PRIVACY = ['Never shown to others', 'Aggregate only', 'No public profile'];
// The mood faces are a static, non-interactive marketing preview of the check-in
// scale — labels describe the scale, not any per-user data.
const MOOD_FACES_MOBILE: { emoji: string; label: string }[] = [
  { emoji: '😢', label: 'Low' },
  { emoji: '😔', label: 'Down' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😄', label: 'Great' },
];

function MobileMoodPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      {/* Top row: back control on the left, and a Sign In link on the right so both paths are clear
          (the main button below is the sign-up / join path). In verify mode the single "Finish
          verifying" button below is the only action, so no Sign In is shown here. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <PublicShellBackLink />
        {!verifyUrl ? (
          <a href={signInUrl} style={{ padding: '6px 14px', borderRadius: 8, background: t.BORDER_STRONG, border: '1px solid rgba(255,255,255,0.15)', color: t.TITLE, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Sign In</a>
        ) : null}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 40px', gap: 20, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, background: t.ACCENT + '20', border: `2px solid ${t.ACCENT}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Smile size={28} color={t.ACCENT} />
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600 }}>Pseudonymous</span>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
          Check in with yourself.<br /><span style={{ color: t.ACCENT }}>No names, no spotlight.</span>
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, maxWidth: 300 }}>Your check-ins are pseudonymous — kept under a random ID separate from your account. Daily check-ins unlock resources and gentle nudges.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRIVACY.map((p) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Shield size={12} color={t.ACCENT} />
              <span style={{ fontSize: 13, color: t.SUBTLE }}>{p}</span>
            </div>
          ))}
        </div>

        <div style={{ borderRadius: 16, border: `1px solid ${t.BORDER_STRONG}`, padding: '20px 24px', background: 'rgba(255,255,255,0.02)', width: '100%' }}>
          <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 14 }}>How are you feeling today?</div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {MOOD_FACES_MOBILE.map((m) => (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 24 }}>{m.emoji}</span>
                <span style={{ fontSize: 10, color: t.MUTED }}>{m.label}</span>
              </div>
            ))}
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'block', textAlign: 'center', boxSizing: 'border-box' }}>
            {verifyUrl ? 'Finish verifying' : 'Join to track your journey'}
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for Mood. Renders the public marketing experience
 * pixel-faithful to the MoodPublic (desktop) and MobileMoodPublic (phone) design
 * mockups, with sign-in affordances pointing at the real hosted sign-in URL. It
 * shows no private or per-user data — the mood-face row is a static preview of
 * the check-in scale, not any recorded mood.
 */
export function MoodPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileMoodPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
