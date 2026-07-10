'use client';

import { ListChecks, UserPlus, BadgeCheck, Ban, Lock, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { getWhatWorksTokens, type WhatWorksTokens } from './ww-shared';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Why trust this list — static marketing copy.
const trustItems = (t: WhatWorksTokens) => [
  { icon: <BadgeCheck size={15} color={t.ACCENT} />, t: 'Survivor-verified', d: 'Used by a real member who said it helped.' },
  { icon: <Ban size={15} color={t.ACCENT} />, t: 'No ads or affiliates', d: 'Nothing here is sponsored.' },
  { icon: <Lock size={15} color={t.ACCENT} />, t: 'Anonymous', d: 'Suggesting never reveals who you are.' },
];

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

function DesktopWhatWorksPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  const TRUST = trustItems(t);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100%', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE, overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10, flexShrink: 0, background: t.HEADER }}>
        <PublicShellBackLink />
        <ListChecks size={18} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>What Works</span>
        <span style={{ fontSize: 12, color: t.MUTED, marginLeft: 4 }}>· survivor-verified tools</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.BORDER, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
              <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <UserPlus size={13} /> Create Account
              </a>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Hero */}
        <div style={{ padding: '44px 64px 28px', display: 'flex', gap: 48, alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ padding: '4px 14px', borderRadius: 20, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, fontSize: 12, color: t.ACCENT, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
              <BadgeCheck size={13} /> One shared, survivor-verified list
            </span>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em' }}>
              The tools that<br /><span style={{ color: t.ACCENT }}>actually work</span>.
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: t.SUBTLE, maxWidth: 520, lineHeight: 1.7 }}>
              Pick a problem you&apos;re facing. Underneath it is a list of specific products a survivor here bought, used, and said helped — each with a direct link to get it. No ads. No affiliates. Nothing sold.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <a href={verifyUrl ?? signInUrl} style={{ padding: '13px 28px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                {verifyUrl ? 'Finish verifying' : <><UserPlus size={16} /> Join to suggest items</>}
              </a>
            </div>
          </div>
          <div style={{ width: 260, flexShrink: 0 }}>
            <div style={{ padding: '18px', borderRadius: 16, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, marginBottom: 14 }}>Why trust this list?</div>
              {TRUST.map(({ icon, t: title, d }) => (
                <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: t.TITLE, marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: t.MUTED, lineHeight: 1.5 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* List preview — honest empty state (no fabricated reviews) */}
        <div style={{ padding: '0 64px 56px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>A look at the list</span>
            <span style={{ fontSize: 12, color: t.MUTED }}>· survivor-verified, opens after you join</span>
          </div>

          <PreviewEmptyState />

          {/* Join gate */}
          <div style={{ marginTop: 28, padding: '24px', borderRadius: 16, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}25`, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>See every problem — and add what worked for you</div>
              <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6 }}>Create a free, verified account to view the full list and suggest the tools that helped you.</div>
            </div>
            <a href={verifyUrl ?? signInUrl} style={{ padding: '13px 26px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}>
              {verifyUrl ? 'Finish verifying' : <>Get started <ChevronRight size={15} /></>}
            </a>
          </div>
        </div>
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
  const isMobile = useIsMobile();
  return isMobile ? <MobileWhatWorksPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopWhatWorksPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
