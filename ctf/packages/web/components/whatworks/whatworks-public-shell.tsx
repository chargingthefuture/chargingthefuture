'use client';

import { ListChecks, UserPlus, BadgeCheck, Ban, Lock, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the WhatWorksPublic / MobileWhatWorksPublic design mockups.
const BRAND = '#84CC16';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Why trust this list — static marketing copy.
const TRUST = [
  { icon: <BadgeCheck size={15} color={BRAND} />, t: 'Survivor-verified', d: 'Used by a real member who said it helped.' },
  { icon: <Ban size={15} color={BRAND} />, t: 'No ads or affiliates', d: 'Nothing here is sponsored.' },
  { icon: <Lock size={15} color={BRAND} />, t: 'Anonymous', d: 'Suggesting never reveals who you are.' },
];

// The mockup's "A look at the list" preview hardcoded sample survivor reviews
// (specific products, quoted notes, verified counts). A public visitor has no
// session and the live list is not wired in, so the preview renders an honest
// empty state that keeps the section framing without inventing reviews.
function PreviewEmptyState({ compact }: { compact?: boolean }) {
  return (
    <div style={{ borderRadius: 14, border: `1px dashed ${BORDER}`, background: `${BRAND}06`, padding: compact ? '20px 16px' : '28px 24px', textAlign: 'center' }}>
      <div style={{ width: compact ? 38 : 44, height: compact ? 38 : 44, borderRadius: '50%', background: `${BRAND}12`, border: `1px solid ${BRAND}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
        <ListChecks size={compact ? 17 : 20} color={BRAND} />
      </div>
      <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: TEXT, marginBottom: 4 }}>The verified list opens once you join</div>
      <div style={{ fontSize: compact ? 12 : 12.5, color: SUBTLE, lineHeight: 1.55, maxWidth: 420, margin: '0 auto' }}>
        Each problem holds the specific tools a survivor here bought, used, and said helped. Create a free, verified account to browse them and add what worked for you.
      </div>
    </div>
  );
}

function DesktopWhatWorksPublic({ signInUrl }: { signInUrl: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100%', background: BG, fontFamily: FONT_FAMILY, color: TEXT, overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10, flexShrink: 0, background: '#0D0F14' }}>
        <ListChecks size={18} color={BRAND} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>What Works</span>
        <span style={{ fontSize: 12, color: SUBTLE, marginLeft: 4 }}>· survivor-verified tools</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
          <a href={signInUrl} style={{ padding: '7px 16px', borderRadius: 8, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
            <UserPlus size={13} /> Create Account
          </a>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Hero */}
        <div style={{ padding: '44px 64px 28px', display: 'flex', gap: 48, alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ padding: '4px 14px', borderRadius: 20, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, fontSize: 12, color: BRAND, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
              <BadgeCheck size={13} /> One shared, survivor-verified list
            </span>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em' }}>
              The tools that<br /><span style={{ color: BRAND }}>actually work</span>.
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 520, lineHeight: 1.7 }}>
              Pick a problem you&apos;re facing. Underneath it is a list of specific products a survivor here bought, used, and said helped — each with a direct link to get it. No ads. No affiliates. Nothing sold.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <a href={signInUrl} style={{ padding: '13px 28px', borderRadius: 10, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <UserPlus size={16} /> Join to suggest items
              </a>
            </div>
          </div>
          <div style={{ width: 260, flexShrink: 0 }}>
            <div style={{ padding: '18px', borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND, marginBottom: 14 }}>Why trust this list?</div>
              {TRUST.map(({ icon, t, d }) => (
                <div key={t} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{t}</div>
                    <div style={{ fontSize: 11.5, color: SUBTLE, lineHeight: 1.5 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* List preview — honest empty state (no fabricated reviews) */}
        <div style={{ padding: '0 64px 56px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>A look at the list</span>
            <span style={{ fontSize: 12, color: SUBTLE }}>· survivor-verified, opens after you join</span>
          </div>

          <PreviewEmptyState />

          {/* Join gate */}
          <div style={{ marginTop: 28, padding: '24px', borderRadius: 16, background: `${BRAND}08`, border: `1px solid ${BRAND}25`, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>See every problem — and add what worked for you</div>
              <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6 }}>Create a free, verified account to view the full list and suggest the tools that helped you.</div>
            </div>
            <a href={signInUrl} style={{ padding: '13px 26px', borderRadius: 10, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}>
              Get started <ChevronRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileWhatWorksPublic({ signInUrl }: { signInUrl: string }) {
  return (
    <div style={{ width: '100%', height: '100vh', maxHeight: '100%', background: BG, fontFamily: FONT_FAMILY, color: TEXT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: '#0D0F14', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ListChecks size={17} color={BRAND} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>What Works</span>
        <a href={signInUrl} style={{ marginLeft: 'auto', padding: '6px 13px', borderRadius: 8, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Sign In</a>
      </div>

      {/* Scroll */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 16px' }}>
        <span style={{ padding: '4px 11px', borderRadius: 20, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, fontSize: 11, color: BRAND, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <BadgeCheck size={12} /> One shared, survivor-verified list
        </span>
        <h1 style={{ margin: '12px 0 8px', fontSize: 24, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
          The tools that<br /><span style={{ color: BRAND }}>actually work</span>.
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', lineHeight: 1.65 }}>
          Pick a problem you&apos;re facing. Underneath is a list of specific products a survivor here used and said helped — each with a direct link. No ads. Nothing sold.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '20px 0 12px' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>A look at the list</span>
          <span style={{ fontSize: 11, color: SUBTLE }}>· opens after you join</span>
        </div>

        <PreviewEmptyState compact />

        {/* Gate */}
        <div style={{ marginTop: 20, padding: '18px', borderRadius: 14, background: `${BRAND}08`, border: `1px solid ${BRAND}25`, textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${BRAND}15`, border: `1px solid ${BRAND}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <Lock size={18} color={BRAND} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>See every problem &amp; add yours</div>
          <div style={{ fontSize: 12.5, color: SUBTLE, lineHeight: 1.55, marginBottom: 14 }}>Create a free, verified account to view the full list and suggest what worked for you.</div>
          <a href={signInUrl} style={{ width: '100%', padding: '12px', borderRadius: 10, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxSizing: 'border-box', textDecoration: 'none' }}>
            <UserPlus size={15} /> Create free account
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
export function WhatWorksPublicShell({ signInUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileWhatWorksPublic signInUrl={signInUrl} /> : <DesktopWhatWorksPublic signInUrl={signInUrl} />;
}
