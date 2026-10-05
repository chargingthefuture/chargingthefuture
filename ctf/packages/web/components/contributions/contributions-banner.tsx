'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, MessageSquare, Star } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import {
  FONT_FAMILY,
  GOAL_COLORS,
  getContributionsTokens,
  progressPct,
  type FundraiserResponse,
} from './contributions-shared';
import { reportError } from 'lib/observability/report';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

// The banner and the gift reminder are non-critical chrome: a failed fundraiser read only means they do
// not show. It still leaves a trace. A 401 or 403 is not reported — it means this viewer has no access
// to Contributions right now (signed out, or the plugin is switched off), which is expected.
async function loadBannerFundraiser(
  signal: AbortSignal,
  op: string,
): Promise<FundraiserResponse['fundraiser'] | null> {
  try {
    const res = await fetch('/api/contributions/fundraiser', { cache: 'no-store', signal });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) {
        reportError(new Error(`Fundraiser read for the banner answered HTTP ${res.status}`), {
          area: 'contributions',
          op,
          extra: { status: res.status },
        });
      }
      return null;
    }
    const data = (await res.json()) as FundraiserResponse;
    return data.fundraiser;
  } catch (error) {
    // An AbortError is ordinary teardown (the component unmounted mid-request), so it is not reported.
    if ((error as Error | null)?.name !== 'AbortError') {
      reportError(error, { area: 'contributions', op });
    }
    return null;
  }
}

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
 * Dismissing does not remove the reminder entirely — the reminder becomes the small gift emoji in
 * the Commons chip row, just after the 🔔 notifications chip (ContributionsGiftTrigger below), so no
 * strip of vertical space is spent on it. The full banner returns on its own when the snooze lapses.
 */

// Cross-component signal: the banner's "Not now" tells the gift trigger to appear without a
// reload (the two components fetch fundraiser state independently).
const BANNER_DISMISSED_EVENT = 'ctf:contributions-banner-dismissed';
export function ContributionsBanner() {
  const { theme } = useTheme();
  const t = getContributionsTokens(theme);
  const router = useRouter();

  const [fundraiser, setFundraiser] = useState<FundraiserResponse['fundraiser'] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const loaded = await loadBannerFundraiser(controller.signal, 'banner_fundraiser_load');
      if (loaded && !controller.signal.aborted) {
        setFundraiser(loaded);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const onContribute = useCallback(() => router.push('/apps/contributions'), [router]);

  const onDismiss = useCallback(async () => {
    setCollapsed(true);
    window.dispatchEvent(new Event(BANNER_DISMISSED_EVENT));
    // Best-effort: even if the snooze write fails, the banner stays collapsed for this session. A refused
    // or failed write is reported, since the full banner then returns on the next page load.
    try {
      const res = await fetch('/api/contributions/banner/dismiss', { method: 'POST', headers: CSRF_HEADERS });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { code?: unknown; message?: unknown } | null;
        reportError(new Error(`Banner dismiss answered HTTP ${res.status}: ${String(body?.message ?? 'no message')}`), {
          area: 'contributions',
          op: 'banner_dismiss',
          extra: { status: res.status, code: body?.code ?? null },
        });
      }
    } catch (error) {
      reportError(error, { area: 'contributions', op: 'banner_dismiss' });
    }
  }, []);

  // No active drive, or the banner feature is turned off entirely → render nothing.
  if (!fundraiser || !fundraiser.cycle || !fundraiser.bannerEnabled) {
    return null;
  }

  const showFullBanner = fundraiser.bannerVisible && !collapsed;

  // Dismissed or snoozed → nothing here. The reminder lives on as the gift emoji in the Commons
  // chip row (ContributionsGiftTrigger); a dedicated strip here read as wasted space.
  if (!showFullBanner) {
    return null;
  }

  const goals = bannerGoals(fundraiser);

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

/**
 * The gift reminder: a small 🎁 that opens the Contributions plugin. It appears only while a drive
 * is active AND the full banner is not showing (dismissed this session or server-snoozed), so the
 * reminder survives without spending a strip of vertical space.
 *
 * It used to sit in the top bar beside the brand mark, but on a narrow phone (iPhone SE) that bar
 * ran out of room, so it now rides in the Commons chip row just after the 🔔 notifications chip
 * (owner placement decision, 2026-08-09). The caller supplies `className` so the button matches
 * whichever row it sits in.
 */
export function ContributionsGiftTrigger({ className }: { className: string }) {
  const router = useRouter();

  const [fundraiser, setFundraiser] = useState<FundraiserResponse['fundraiser'] | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const loaded = await loadBannerFundraiser(controller.signal, 'gift_trigger_fundraiser_load');
      if (loaded && !controller.signal.aborted) setFundraiser(loaded);
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

  if (!fundraiser || !fundraiser.cycle || !fundraiser.bannerEnabled) {
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
      className={className}
    >
      🎁
    </button>
  );
}
