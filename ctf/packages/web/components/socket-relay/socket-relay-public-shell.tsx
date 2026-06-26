'use client';

import {
  Share2, Search, Shield, ShieldCheck, Lock, LogIn, UserPlus, Heart, Plus,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { getAppAccent } from '@/lib/theme/theme-tokens';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Palette from the SocketRelayPublic / MobileSocketRelayPublic mockups.
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
// The plugin accent is the single source of truth in the per-plugin registry, so the signed-out
// public shell matches the signed-in in-app shell on every device and in every auth state. The mobile
// mockup had used a divergent red (#F43F5E); that drift is corrected by reading the registry value
// (#FB923C) for both layouts.
const SR_ACCENT = getAppAccent('socket-relay', 'default');
const ACCENT = '#7C3AED';
const ACCENT_CYAN = '#0EA5E9';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

const CATEGORIES = ['All', 'Food', 'Transport', 'Legal', 'Employment', 'Childcare', 'Housing'];

function DesktopSocketRelayPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const COLOR = SR_ACCENT;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: BG, fontFamily: FONT_FAMILY, color: TEXT }}>
      {/* Marketing banner */}
      <div style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_CYAN} 100%)`, padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Share2 size={15} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>SocketRelay · Mutual aid, free forever</span>
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
                <UserPlus size={13} /> Post a Need Free →
              </a>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left sidebar */}
        <aside style={{ width: 300, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 16px 10px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Share2 size={16} color={COLOR} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>SocketRelay</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, background: `${COLOR}18`, color: COLOR, border: `1px solid ${COLOR}30`, borderRadius: 4, padding: '2px 7px' }}>Public Feed</span>
            </div>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: SUBTLE }} />
              <input placeholder="Search needs & offers…" style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: SUBTLE, outline: 'none', boxSizing: 'border-box' }} readOnly />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map((c) => (
                <span key={c} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, border: `1px solid ${c === 'All' ? COLOR + '50' : BORDER}`, color: c === 'All' ? COLOR : SUBTLE, background: c === 'All' ? `${COLOR}10` : 'transparent', cursor: 'default' }}>{c}</span>
              ))}
            </div>
          </div>

          {/* How it works (static marketing copy, no fabricated counts) */}
          <div style={{ padding: '12px 12px 8px' }}>
            {[
              'Post a need or an offer — always free',
              'Anonymous posts are supported',
              'Survivors respond and connect directly',
            ].map((l) => (
              <div key={l} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0', borderBottom: `1px solid ${BORDER}` }}>
                <Heart size={13} color={COLOR} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: SUBTLE }}>{l}</span>
              </div>
            ))}
          </div>

          {/* Auth gate to post */}
          <div style={{ margin: '12px', borderRadius: 12, border: `2px dashed ${COLOR}30`, background: `${COLOR}06`, padding: '16px', textAlign: 'center' }}>
            <Lock size={16} color={SUBTLE} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>Sign in to post or respond</div>
            <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 10 }}>Posting is always free. Anonymous posts supported.</div>
            <a href={verifyUrl ?? signInUrl} style={{ display: 'block', width: '100%', padding: '9px', borderRadius: 8, background: `linear-gradient(90deg,${ACCENT},${ACCENT_CYAN})`, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', boxSizing: 'border-box', textDecoration: 'none' }}>
              {verifyUrl ? 'Finish verifying' : 'Create Free Account →'}
            </a>
          </div>
        </aside>

        {/* Main feed */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Live Relay Feed</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Public · Updates in real time</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: SURFACE, border: `1px solid ${BORDER}` }}>
                <ShieldCheck size={12} color={ACCENT_CYAN} />
                <span style={{ fontSize: 11, color: ACCENT_CYAN }}>Survivor Verified</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: SURFACE, border: `1px solid ${BORDER}` }}>
                <Shield size={12} color={SUBTLE} />
                <span style={{ fontSize: 11, color: SUBTLE }}>Anonymous posts protected</span>
              </div>
            </div>
          </div>

          {/* Blurred feed preview + lock (neutral placeholders, no fabricated needs/offers) */}
          <div style={{ flex: 1, position: 'relative', minHeight: 360 }}>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => {
                const need = i % 2 === 0;
                return (
                  <div key={i} style={{ borderRadius: 12, border: `1px solid ${need ? '#FB923C30' : '#22C55E30'}`, background: need ? '#FB923C06' : '#22C55E06', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: need ? '#FB923C20' : '#22C55E20', color: need ? '#FB923C' : '#22C55E' }}>{need ? 'NEED' : 'OFFER'}</span>
                      <span style={{ height: 14, width: 60, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                    <div style={{ height: 13, width: '70%', borderRadius: 6, background: 'rgba(255,255,255,0.10)', marginBottom: 10 }} />
                    <div style={{ height: 10, width: '45%', borderRadius: 5, background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                );
              })}
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={22} color={COLOR} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Sign in to see the live relay feed</div>
              <div style={{ fontSize: 13, color: SUBTLE, textAlign: 'center', maxWidth: 320 }}>
                Browse open needs and offers, then respond directly. Posting is always free and anonymous posts are supported.
              </div>
              <a href={verifyUrl ?? signInUrl} style={{ padding: '12px 28px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
                {verifyUrl ? 'Finish verifying' : 'Sign in to respond'}
              </a>
            </div>
          </div>

          {/* Bottom CTA */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: SUBTLE }}>Want to help or need something?</div>
            {verifyUrl ? (
              <a href={verifyUrl} style={{ padding: '9px 22px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                Finish verifying
              </a>
            ) : (
              <>
                <a href={signInUrl} style={{ padding: '9px 22px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                  <Plus size={14} /> Post a Need
                </a>
                <a href={signInUrl} style={{ padding: '9px 22px', borderRadius: 9, background: 'transparent', border: `1px solid ${COLOR}50`, color: COLOR, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                  <Heart size={14} /> Post an Offer
                </a>
              </>
            )}
            <div style={{ marginLeft: 'auto', fontSize: 12, color: SUBTLE, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Shield size={12} color={SUBTLE} /> Anonymous posts always available
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MobileSocketRelayPublic({ signInUrl, verifyUrl }: { signInUrl: string; verifyUrl?: string }) {
  const COLOR = SR_ACCENT;
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: TEXT }}>
      <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Share2 size={20} color={COLOR} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Socket Relay</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: COLOR + '20', border: `1px solid ${COLOR}40`, fontSize: 11, color: COLOR, fontWeight: 600, width: 'fit-content' }}>Peer-to-peer needs board</span>
        <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>Post what you need, offer what you have. Clothing, furniture, skills, time — the survivor community connects directly.</p>
        <a href={verifyUrl ?? signInUrl} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Join the Hub — Free'}</a>
      </div>

      {/* Blurred feed preview + lock (neutral placeholders) */}
      <div style={{ flex: 1, padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.5 }} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => {
            const need = i % 2 === 0;
            return (
              <div key={i} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: need ? COLOR + '20' : '#22C55E20', color: need ? COLOR : '#22C55E' }}>{need ? 'NEED' : 'OFFER'}</span>
                </div>
                <div style={{ height: 13, width: '75%', borderRadius: 6, background: 'rgba(255,255,255,0.10)' }} />
                <div style={{ height: 10, width: '35%', borderRadius: 5, background: 'rgba(255,255,255,0.05)', marginTop: 8 }} />
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${COLOR}50`, background: COLOR + '10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={COLOR} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Sign in to post and respond</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-out visitor view for SocketRelay. Pixel-faithful to the SocketRelayPublic
 * (desktop) and MobileSocketRelayPublic (phone) design mockups, with every sign-in
 * affordance pointing at the real hosted sign-in URL. Each breakpoint keeps its own
 * mockup accent (desktop #FB923C, phone #F43F5E).
 *
 * Real-data-only deviations from the mockup (no session = no live data): the
 * desktop mockup's banner counters (847 open requests, 12,400 fulfilled this
 * month), the sidebar stat rows (847 active requests, 12.4K fulfilled, $0 to
 * post), and every relay request/offer card (named posters like Marcus B.,
 * Amara O., James T., locations, credit amounts, timestamps) are invented sample
 * data, so the counters are dropped, the sidebar shows static "how it works" copy,
 * and the feed renders neutral blurred placeholder cards behind a sign-in lock.
 * The phone mockup's four blurred sample posts are likewise replaced with neutral
 * placeholders. The search input and category chips are read-only marketing
 * decoration; the simulated phone status bar is dropped because the real app
 * renders inside the browser chrome.
 */
export function SocketRelayPublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileSocketRelayPublic signInUrl={signInUrl} verifyUrl={verifyUrl} /> : <DesktopSocketRelayPublic signInUrl={signInUrl} verifyUrl={verifyUrl} />;
}
