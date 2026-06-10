'use client';

import { Heart, Clock } from 'lucide-react';
import { FONT_FAMILY, type ContributionsTokens } from './contributions-shared';

function Skeleton({ w, h, radius = 6, t }: { w: string | number; h: number; radius?: number; t: ContributionsTokens }) {
  return <div style={{ width: w, height: h, borderRadius: radius, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }} />;
}

/** Desktop loading skeleton mirroring the three-column main layout (sidebar, body, history). */
function DesktopLoading({ t }: { t: ContributionsTokens }) {
  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, overflow: 'hidden' }}>
      <div style={{ width: 200, background: t.SURFACE, borderRight: `1px solid ${t.BORDER_SOLID}`, padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={14} color="#fff" />
          </div>
          <Skeleton w={90} h={14} t={t} />
        </div>
        {[100, 80, 90].map((w, i) => (
          <Skeleton key={i} w={w} h={12} t={t} />
        ))}
      </div>

      <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Skeleton w={280} h={22} radius={8} t={t} />
        <Skeleton w={460} h={14} t={t} />
        <Skeleton w={360} h={14} t={t} />
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, background: t.SURFACE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${t.BORDER_SOLID}` }}>
              <Skeleton w="60%" h={12} t={t} />
              <div style={{ margin: '12px 0 8px' }}>
                <Skeleton w="40%" h={22} radius={4} t={t} />
              </div>
              <Skeleton w="100%" h={6} radius={99} t={t} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 4 }}>
          <Skeleton w={200} h={16} t={t} />
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, background: t.SURFACE, borderRadius: 10, padding: 16, border: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Skeleton w={30} h={30} radius={8} t={t} />
                  <Skeleton w={80} h={14} t={t} />
                </div>
                <Skeleton w="80%" h={12} t={t} />
                <Skeleton w="60%" h={11} t={t} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ width: 280, background: t.SURFACE, borderLeft: `1px solid ${t.BORDER_SOLID}`, padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
          <Clock size={14} color={t.ACCENT} />
          <Skeleton w={120} h={14} t={t} />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ background: t.BG, borderRadius: 9, padding: 12, border: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton w="80%" h={13} t={t} />
            <Skeleton w="55%" h={11} t={t} />
            <Skeleton w="40%" h={11} t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Phone-width loading skeleton mirroring the header + tab + stacked-card layout. */
function MobileLoading({ t }: { t: ContributionsTokens }) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px 10px', background: t.SURFACE, borderBottom: `1px solid ${t.BORDER_SOLID}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={13} color="#fff" />
          </div>
          <Skeleton w={130} h={16} t={t} />
        </div>
        <Skeleton w={180} h={12} t={t} />
      </div>
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton w="80%" h={14} t={t} />
        <Skeleton w="60%" h={14} t={t} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ background: t.SURFACE, borderRadius: 10, padding: '12px 14px', border: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton w={30} h={30} radius={8} t={t} />
              <Skeleton w={100} h={14} t={t} />
            </div>
            <Skeleton w="70%" h={12} t={t} />
            <Skeleton w={160} h={6} radius={99} t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContributionsLoading({ t, isMobile }: { t: ContributionsTokens; isMobile: boolean }) {
  return isMobile ? <MobileLoading t={t} /> : <DesktopLoading t={t} />;
}
