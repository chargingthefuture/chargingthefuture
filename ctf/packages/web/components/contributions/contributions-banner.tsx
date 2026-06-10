'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, DollarSign, MessageSquare, Star } from 'lucide-react';
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
 * only renders while a drive is active and the snapshot says it is visible for this member.
 * "Contribute" opens the plugin; "Not now" calls the server-side silent snooze (the duration is
 * never shown). Desktop and phone-width layouts mirror the Contributions*Banner mockups.
 */
export function ContributionsBanner() {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getContributionsTokens(theme);
  const router = useRouter();

  const [fundraiser, setFundraiser] = useState<FundraiserResponse['fundraiser'] | null>(null);
  const [dismissed, setDismissed] = useState(false);

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

  const onDismiss = useCallback(async () => {
    setDismissed(true);
    try {
      await fetch('/api/contributions/banner/dismiss', { method: 'POST', headers: CSRF_HEADERS });
    } catch {
      // Best-effort: even if the snooze write fails, the banner stays hidden for this session.
    }
  }, []);

  if (dismissed || !fundraiser || !fundraiser.cycle || !fundraiser.bannerVisible) {
    return null;
  }

  const goals = bannerGoals(fundraiser);
  const onContribute = () => router.push('/apps/contributions');

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
        <Heart size={13} color="#fff" />
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
