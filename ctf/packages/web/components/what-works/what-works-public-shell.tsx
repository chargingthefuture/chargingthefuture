'use client';

import { ListChecks, UserPlus, BadgeCheck, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getWhatWorksTokens } from './ww-shared';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// The mockup's "A look at the list" preview hardcoded sample survivor reviews
// (specific products, quoted notes, verified counts). A public visitor has no
// session and the live list is not wired in, so the preview renders an honest
// empty state that keeps the section framing without inventing reviews.
function PreviewEmptyState({ compact }: { compact?: boolean }) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <div style={{ borderRadius: 14, border: `1px dashed ${t.BORDER_SOLID}`, background: `${t.ACCENT}06`, padding: compact ? '20px 16px' : '28px 24px', textAlign: 'center' }}>
      <div style={{ width: compact ? 38 : 44, height: compact ? 38 : 44, borderRadius: '50%', background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
        <ListChecks size={compact ? 17 : 20} color={t.ACCENT} />
      </div>
      <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>The verified list opens once you join</div>
      <div style={{ fontSize: compact ? 12 : 12.5, color: t.MUTED, lineHeight: 1.55, maxWidth: 420, margin: '0 auto' }}>
        Each problem holds the specific tools a survivor here bought, used, and said helped. Create a free, verified account to browse them and add what worked for you.
      </div>
    </div>
  );
}

function MobileWhatWorksPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <div style={{ width: '100%', height: '100dvh', maxHeight: '100%', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: t.HEADER, borderBottom: `1px solid ${t.BORDER_SOLID}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <PublicShellBackLink />
        <ListChecks size={17} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>What Works</span>
        <a href={verifyUrl ?? signInUrl} style={{ marginLeft: 'auto', padding: '6px 13px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign In'}</a>
      </div>

      {/* Scroll */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 16px' }}>
        <span style={{ padding: '4px 11px', borderRadius: 20, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, fontSize: 11, color: t.ACCENT, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <BadgeCheck size={12} /> One shared, survivor-verified list
        </span>
        <h1 style={{ margin: '12px 0 8px', fontSize: 24, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
          The tools that<br /><span style={{ color: t.ACCENT }}>actually work</span>.
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: t.SUBTLE, lineHeight: 1.65 }}>
          Pick a problem you&apos;re facing. Underneath is a list of specific products a survivor here used and said helped — each with a direct link. No ads. Nothing sold.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '20px 0 12px' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>A look at the list</span>
          <span style={{ fontSize: 11, color: t.MUTED }}>· opens after you join</span>
        </div>

        <PreviewEmptyState compact />

        {/* Gate */}
        <div style={{ marginTop: 20, padding: '18px', borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}25`, textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <Lock size={18} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>See every problem &amp; add yours</div>
          <div style={{ fontSize: 12.5, color: t.MUTED, lineHeight: 1.55, marginBottom: 14 }}>Create a free, verified account to view the full list and suggest what worked for you.</div>
          <a href={verifyUrl ?? signInUrl} style={{ width: '100%', padding: '12px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxSizing: 'border-box', textDecoration: 'none' }}>
            {verifyUrl ? 'Finish verifying' : <><UserPlus size={15} /> Create free account</>}
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for What Works. Pixel-faithful to the WhatWorksPublic
 * (desktop) and MobileWhatWorksPublic (phone) design mockups, with every
 * sign-in, join, and call-to-action pointing at the real hosted sign-in URL.
 *
 * Real-data-only deviation (no session = no private/fabricated data): the
 * mockup's "A look at the list" preview hardcoded sample survivor reviews
 * (specific products, quoted notes, "N verified" counts). The live list is not
 * wired into the public view, so the preview is replaced with an honest empty
 * state that keeps the section framing and marketing copy without inventing
 * reviews or verified counts. The simulated phone status bar is dropped because
 * the real app renders inside the browser chrome.
 */
export function WhatWorksPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return <MobileWhatWorksPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
