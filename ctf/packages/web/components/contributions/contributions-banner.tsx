'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, DollarSign, MessageSquare, Star } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import {
  FONT_FAMILY,
  GOAL_COLORS,
  getContributionsTokens,
  progressPct,
  type FundraiserResponse,
} from './contributions-shared';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

type BannerGoal = { label: string; current: number; target: number; unit: string; Icon: typeof DollarSign; color: string };

function bannerGoals(f: FundraiserResponse['fundraiser']): BannerGoal[] {
  return [
    { label: 'Funding', current: f.fiatConfirmedUsd, target: f.cycle?.fiatGoalUsd ?? 0, unit: '$', Icon: DollarSign, color: GOAL_COLORS.funding },
    { label: 'Quora', current: f.quoraCommentsConfirmed, target: f.cycle?.quoraCommentGoal ?? 0, unit: '', Icon: MessageSquare, color: GOAL_COLORS.quora },
    { label: 'Stars', current: f.githubStarsConfirmed, target: f.cycle?.githubStarGoal ?? 0, unit: '', Icon: Star, color: GOAL_COLORS.github },
  ];
}

/**
 * The app-wide, dismissible fundraiser banner. It is non-blocking (a slim bar, never a modal) and
 * only renders while a drive is active and the banner feature is on. "Contribute" opens the plugin;
 * "Not now" calls the server-side silent snooze (the duration is never shown).
 *
 * On phone width, dismissing does not remove the reminder entirely — the reminder becomes the small
 * gift emoji in the top bar (ContributionsGiftTrigger below, mounted between the TSE mark and the
 * section tabs), so no strip of vertical space is spent on it. The full banner returns on its own
 * when the snooze lapses. On desktop, dismissing hides it until the snooze lapses (no emoji — a
 * slim desktop bar is already unobtrusive).
 */

// Cross-component signal: the banner's "Not now" tells the top-bar trigger to appear without a
// reload (the two components fetch fundraiser state independently).
const BANNER_DISMISSED_EVENT = 'ctf:contributions-banner-dismissed';
export function ContributionsBanner() {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getContributionsTokens(theme);
  const router = useRouter();

  const [fundraiser, setFundraiser] = useState<FundraiserResponse['fundraiser'] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch('/api/contributions/fundraiser', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as FundraiserResponse;
        if (!controller.signal.aborted) {
          setFundraiser(data.fundraiser);
        }
      } catch {
        // A banner is non-critical chrome — a failed load just means it does not show.
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const onContribute = useCallback(() => router.push('/apps/contributions'), [router]);

  const onDismiss = useCallback(async () => {
    setCollapsed(true);
    window.dispatchEvent(new Event(BANNER_DISMISSED_EVENT));
    try {
      await fetch('/api/contributions/banner/dismiss', { method: 'POST', headers: CSRF_HEADERS });
    } catch {
      // Best-effort: even if the snooze write fails, the banner stays collapsed for this session.
    }
  }, []);

  // No active drive, or the banner feature is turned off entirely → render nothing.
  if (!fundraiser || !fundraiser.cycle || !fundraiser.bannerEnabled) {
    return null;
  }

  const showFullBanner = fundraiser.bannerVisible && !collapsed;

  // Dismissed or snoozed → nothing here. On phone width the reminder lives on as the gift emoji
  // in the top bar (ContributionsGiftTrigger); a dedicated strip here read as wasted space.
  if (!showFullBanner) {
    return null;
  }

  const goals = bannerGoals(fundraiser);

  if (isMobile) {
    return (
      <div style={{ padding: '10px 14px', background: `${t.ACCENT}0A`, borderBottom: `1px solid ${t.ACCENT}25`, fontFamily: FONT_FAMILY }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
          {goals.map((g) => {
            const pct = progressPct(g.current, g.target);
            return (
              <div key={g.label} style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: t.MUTED }}>{g.label}</span>
                  <span style={{ fontSize: 10, color: g.color, fontWeight: 600 }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: t.BORDER_SOLID, borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: g.color, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 9, lineHeight: 1.5 }}>
          If everyone who&apos;s able gave a little, the platform&apos;s costs would be covered.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onContribute} style={{ flex: 1, padding: '7px 0', borderRadius: 7, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Contribute
          </button>
          <button type="button" onClick={() => void onDismiss()} style={{ flex: 1, padding: '7px 0', borderRadius: 7, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, cursor: 'pointer' }}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', background: t.SURFACE, borderBottom: `1px solid ${t.BORDER_SOLID}`, fontFamily: FONT_FAMILY, flexWrap: 'wrap' }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Gift size={13} color="#fff" />
      </div>
      <div style={{ fontSize: 13, color: t.MUTED, flexShrink: 0, maxWidth: 260 }}>If everyone who&apos;s able gave a little, this drive would be covered.</div>
      <div style={{ display: 'flex', gap: 14, flex: 1, alignItems: 'center', minWidth: 240 }}>
        {goals.map((g) => {
          const pct = progressPct(g.current, g.target);
          return (
            <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
              <g.Icon size={12} color={g.color} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: t.MUTED }}>{g.label}</span>
                  <span style={{ fontSize: 10, color: g.color }}>
                    {g.unit}
                    {g.current.toLocaleString()} / {g.unit}
                    {g.target.toLocaleString()}
                  </span>
                </div>
                <div style={{ height: 4, background: t.BORDER_SOLID, borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: g.color, borderRadius: 99 }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <button type="button" onClick={onContribute} style={{ padding: '6px 16px', borderRadius: 7, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Contribute
        </button>
        <button type="button" onClick={() => void onDismiss()} style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, cursor: 'pointer' }}>
          Not now
        </button>
      </div>
    </div>
  );
}

/**
 * The phone-top-bar gift reminder: a small 🎁 between the TSE mark and the section tabs (owner
 * placement decision, 2026-07-19). It appears only while a drive is active AND the full banner is
 * not showing (dismissed this session or server-snoozed), so the reminder survives without
 * spending a strip of vertical space. Opens the Contributions plugin. Phone widths only — on
 * desktop a dismissed banner shows nothing until the snooze lapses, unchanged.
 */
export function ContributionsGiftTrigger() {
  const isMobile = useIsMobile();
  const router = useRouter();

  const [fundraiser, setFundraiser] = useState<FundraiserResponse['fundraiser'] | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch('/api/contributions/fundraiser', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as FundraiserResponse;
        if (!controller.signal.aborted) setFundraiser(data.fundraiser);
      } catch {
        // Non-critical chrome: a failed load just means no reminder.
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  // The banner's "Not now" makes this trigger appear immediately, without a reload.
  useEffect(() => {
    const onDismissed = () => setDismissedThisSession(true);
    window.addEventListener(BANNER_DISMISSED_EVENT, onDismissed);
    return () => window.removeEventListener(BANNER_DISMISSED_EVENT, onDismissed);
  }, []);

  if (!isMobile || !fundraiser || !fundraiser.cycle || !fundraiser.bannerEnabled) {
    return null;
  }
  // While the full banner is visible (and not just dismissed), the top-bar reminder is redundant.
  if (fundraiser.bannerVisible && !dismissedThisSession) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => router.push('/apps/contributions')}
      aria-label="Contribute to the platform"
      title="Contribute"
      // Boxed to match the rest of the phone top bar's icon controls (help, settings,
      // admin) — the same surface + border + radius the plugin header uses — so the gift
      // is no longer a bare emoji floating among bordered buttons. Theme tokens carry the
      // default and comic looks.
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ctf-surface, rgba(255, 255, 255, 0.06))',
        border: '1px solid var(--ctf-border, rgba(255, 255, 255, 0.12))',
        color: 'var(--ctf-text, #E5E7EB)',
        cursor: 'pointer',
        fontSize: 16,
        lineHeight: 1,
        padding: 0,
        flexShrink: 0,
      }}
    >
      🎁
    </button>
  );
}
