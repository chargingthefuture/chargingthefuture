'use client';

import { Smile, Shield } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the MoodPublic / MobileMoodPublic design mockups.
const BG = '#0F1117';
const COLOR = '#4ADE80';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

const PRIVACY = ['Never shown to others', 'Aggregate only', 'No public profile'];
// The mood faces are a static, non-interactive marketing preview of the check-in
// scale — labels describe the scale, not any per-user data.
const MOOD_FACES: { emoji: string; label: string }[] = [
  { emoji: '😢', label: 'Struggling' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😄', label: 'Great' },
];
const MOOD_FACES_MOBILE: { emoji: string; label: string }[] = [
  { emoji: '😢', label: 'Low' },
  { emoji: '😔', label: 'Down' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😄', label: 'Great' },
];

function DesktopMoodPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10 }}>
        <Smile size={18} color={COLOR} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Mood</span>
        <div style={{ marginLeft: 'auto' }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '8px 20px', borderRadius: 8, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Finish verifying</a>
          ) : (
            <a href={signInUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Sign In</a>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
        <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, background: COLOR + '20', border: `2px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Smile size={36} color={COLOR} />
          </div>
          <span style={{ padding: '4px 14px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600 }}>Pseudonymous</span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
            Check in with yourself.<br /><span style={{ color: COLOR }}>No names, no spotlight.</span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: SUBTLE, maxWidth: 440 }}>
            Your mood check-ins are pseudonymous — kept under a random ID separate from your account and never shown to anyone. Community trends are anonymous and aggregate-only. Daily check-ins unlock resources, peer support, and gentle nudges.
          </p>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {PRIVACY.map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={13} color={COLOR} />
                <span style={{ fontSize: 13, color: SUBTLE }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', padding: '24px 32px', background: 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%' }}>
            <div style={{ fontSize: 14, color: SUBTLE }}>How are you feeling today?</div>
            <div style={{ display: 'flex', gap: 20 }}>
              {MOOD_FACES.map((m) => (
                <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 28 }}>{m.emoji}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{m.label}</div>
                </div>
              ))}
            </div>
            <a href={verifyUrl ?? signInUrl} style={{ padding: '12px 32px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              {verifyUrl ? 'Finish verifying' : 'Join to track your journey'}
            </a>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: '#4B5563' }}>Sign in to save your streak, access resources, and see community trends.</p>
        </div>
      </div>
    </div>
  );
}

function MobileMoodPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 40px', gap: 20, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, background: COLOR + '20', border: `2px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Smile size={28} color={COLOR} />
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600 }}>Pseudonymous</span>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
          Check in with yourself.<br /><span style={{ color: COLOR }}>No names, no spotlight.</span>
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: SUBTLE, maxWidth: 300 }}>Your check-ins are pseudonymous — kept under a random ID separate from your account. Daily check-ins unlock resources and gentle nudges.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRIVACY.map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Shield size={12} color={COLOR} />
              <span style={{ fontSize: 13, color: SUBTLE }}>{t}</span>
            </div>
          ))}
        </div>

        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', padding: '20px 24px', background: 'rgba(255,255,255,0.02)', width: '100%' }}>
          <div style={{ fontSize: 13, color: SUBTLE, marginBottom: 14 }}>How are you feeling today?</div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {MOOD_FACES_MOBILE.map((m) => (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 24 }}>{m.emoji}</span>
                <span style={{ fontSize: 10, color: '#6B7280' }}>{m.label}</span>
              </div>
            ))}
          </div>
          <a href={verifyUrl ?? signInUrl} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 10, background: COLOR, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'block', textAlign: 'center', boxSizing: 'border-box' }}>
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
  const isMobile = useIsMobile();
  return isMobile ? <MobileMoodPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopMoodPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
