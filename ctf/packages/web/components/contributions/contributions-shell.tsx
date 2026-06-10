'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Clock, ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useTheme } from '@/hooks/useTheme';
import type { ContributionSubmission } from '@/lib/contributions/types';
import {
  FONT_FAMILY,
  getContributionsTokens,
  type ContributionsTokens,
  type FundraiserResponse,
  type SubmissionCreateResponse,
  type SubmissionsResponse,
} from './contributions-shared';
import { AppLoading } from '@/components/shared/app-loading';
import { goalsFromFundraiser, GoalCard, GoalRow } from './contributions-drive-progress';
import { ContributionPaths, type SubmitGiftCardInput } from './contributions-paths';
import { ContributionsHistoryList, ContributionsEmptyHistory } from './contributions-history';
import { ContributionsConfirmation } from './contributions-confirmation';

// Default credit valuations shown in copy until the fundraiser response (which the member route
// does not expose config on) is available. These mirror the seeded defaults; the admin surface is
// the source of truth for the live values.
const DEFAULT_CREDITS_PER_USD = 10;
const DEFAULT_CREDITS_PER_ACTION = 50;

type View = 'main' | 'confirmation';
type MobileTab = 'drive' | 'contribute' | 'history';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

export function ContributionsShell() {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getContributionsTokens(theme);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundraiser, setFundraiser] = useState<FundraiserResponse | null>(null);
  const [submissions, setSubmissions] = useState<ContributionSubmission[]>([]);

  const [view, setView] = useState<View>('main');
  const [mobileTab, setMobileTab] = useState<MobileTab>('drive');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [fundraiserRes, submissionsRes] = await Promise.all([
        fetch('/api/contributions/fundraiser', { cache: 'no-store', signal }),
        fetch('/api/contributions/submission', { cache: 'no-store', signal }),
      ]);
      if (!fundraiserRes.ok || !submissionsRes.ok) {
        throw new Error('We could not load the contribution drive. Try again in a moment.');
      }
      const fundraiserData = (await fundraiserRes.json()) as FundraiserResponse;
      const submissionsData = (await submissionsRes.json()) as SubmissionsResponse;
      if (signal?.aborted) {
        return;
      }
      setFundraiser(fundraiserData);
      setSubmissions(submissionsData.submissions ?? []);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        return;
      }
      setError(e instanceof Error ? e.message : 'We could not load the contribution drive.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const submit = useCallback(
    async (body: Record<string, unknown>, showConfirmation: boolean) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch('/api/contributions/submission', {
          method: 'POST',
          headers: CSRF_HEADERS,
          body: JSON.stringify(body),
        });
        const payload = (await res.json().catch(() => null)) as SubmissionCreateResponse | null;
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.message ?? 'We could not record your contribution. Try again in a moment.');
        }
        await loadData();
        if (showConfirmation) {
          setView('confirmation');
        } else {
          setMobileTab('history');
        }
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'We could not record your contribution.');
      } finally {
        setSubmitting(false);
      }
    },
    [loadData],
  );

  const onSubmitGiftCard = useCallback(
    (input: SubmitGiftCardInput) => {
      void submit({ kind: 'gift_card', method: input.method, claimedAmountUsd: input.claimedAmountUsd, signalContact: input.signalContact }, true);
    },
    [submit],
  );
  const onSubmitQuora = useCallback(
    (quoraPostUrl: string | undefined) => {
      void submit({ kind: 'quora_comment', ...(quoraPostUrl ? { quoraPostUrl } : {}) }, false);
    },
    [submit],
  );
  const onSubmitGithub = useCallback(
    (githubProfileUrl: string | undefined) => {
      void submit({ kind: 'github_star', ...(githubProfileUrl ? { githubProfileUrl } : {}) }, false);
    },
    [submit],
  );

  if (loading && !fundraiser) {
    return <AppLoading />;
  }

  if (error || !fundraiser) {
    return <ErrorState t={t} message={error ?? 'Drive unavailable.'} onRetry={() => void loadData()} isMobile={isMobile} />;
  }

  const goals = goalsFromFundraiser(fundraiser.fundraiser);
  const driveTitle = fundraiser.fundraiser.cycle ? 'Current drive' : 'No active drive';
  const githubStarAlreadyCredited = fundraiser.fundraiser.githubStarAlreadyCredited;

  if (view === 'confirmation') {
    const confirmation = (
      <ContributionsConfirmation
        t={t}
        isMobile={isMobile}
        ownerSignalUrl={fundraiser.ownerSignalUrl}
        signalInstructions={fundraiser.signalInstructions}
        onViewHistory={() => {
          setView('main');
          setMobileTab('history');
        }}
        onBackToHub={() => setView('main')}
      />
    );
    return isMobile ? (
      <MobileFrame t={t}>{confirmation}</MobileFrame>
    ) : (
      <DesktopFrame t={t}>
        <ContributionsSidebar t={t} active="contribute" />
        {confirmation}
      </DesktopFrame>
    );
  }

  const pathsProps = {
    t,
    creditsPerUsd: DEFAULT_CREDITS_PER_USD,
    creditsPerAction: DEFAULT_CREDITS_PER_ACTION,
    githubStarAlreadyCredited,
    submitting,
    error: submitError,
    onSubmitGiftCard,
    onSubmitQuora,
    onSubmitGithub,
  };

  if (isMobile) {
    return (
      <MobileFrame t={t} tab={mobileTab} onTab={setMobileTab}>
        {mobileTab === 'drive' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.7, margin: '0 0 16px' }}>
              If everyone who&apos;s able gave a little, the platform&apos;s costs would be covered — and it stays free for everyone.
            </p>
            {goals.map((g) => (
              <GoalRow key={g.key} goal={g} t={t} />
            ))}
          </div>
        )}
        {mobileTab === 'contribute' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            <ContributionPaths {...pathsProps} />
          </div>
        )}
        {mobileTab === 'history' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {submissions.length === 0 ? (
              <ContributionsEmptyHistory t={t} onContribute={() => setMobileTab('contribute')} />
            ) : (
              <ContributionsHistoryList submissions={submissions} t={t} />
            )}
          </div>
        )}
      </MobileFrame>
    );
  }

  return (
    <DesktopFrame t={t}>
      <ContributionsSidebar t={t} active="drive" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: t.TITLE }}>{driveTitle}</h1>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: t.MUTED, lineHeight: 1.7, maxWidth: 620 }}>
            If every member who can give a little does, the platform&apos;s costs are covered — and it stays free for everyone.
          </p>
          <div style={{ display: 'flex', gap: 14 }}>
            {goals.map((g) => (
              <GoalCard key={g.key} goal={g} t={t} />
            ))}
          </div>
        </div>
        <ContributionPaths {...pathsProps} />
      </div>
      <div style={{ width: 280, background: t.SURFACE, borderLeft: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: `1px solid ${t.BORDER_SOLID}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color={t.ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>My Contributions</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {submissions.length === 0 ? (
            <ContributionsEmptyHistory t={t} onContribute={() => undefined} />
          ) : (
            <ContributionsHistoryList submissions={submissions} t={t} />
          )}
        </div>
      </div>
    </DesktopFrame>
  );
}

// --- frames + chrome ---------------------------------------------------------------------------

function DesktopFrame({ t, children }: { t: ContributionsTokens; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function ContributionsSidebar({ t, active }: { t: ContributionsTokens; active: 'drive' | 'contribute' | 'history' }) {
  const items: { key: string; label: string }[] = [
    { key: 'drive', label: 'Drive progress' },
    { key: 'contribute', label: 'Contribute' },
    { key: 'history', label: 'My contributions' },
  ];
  return (
    <div style={{ width: 200, background: t.SURFACE, borderRight: `1px solid ${t.BORDER_SOLID}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '18px 14px 14px', borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={14} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: t.TITLE }}>Contributions</span>
        </div>
        <div style={{ fontSize: 11, color: t.MUTED }}>Community support drive</div>
      </div>
      <nav style={{ padding: '10px 8px', flex: 1 }}>
        {items.map(({ key, label }) => {
          const isActive = key === active;
          return (
            <div
              key={key}
              style={{
                padding: '8px 10px',
                borderRadius: 7,
                marginBottom: 2,
                fontSize: 13,
                background: isActive ? `${t.ACCENT}18` : 'transparent',
                color: isActive ? t.ACCENT : t.MUTED,
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive ? `3px solid ${t.ACCENT}` : '3px solid transparent',
              }}
            >
              {label}
            </div>
          );
        })}
      </nav>
      <div style={{ padding: '0 10px 16px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 7, fontSize: 12, color: t.MUTED, textDecoration: 'none' }}>
          <ArrowLeft size={13} /> Back to Hub
        </Link>
      </div>
    </div>
  );
}

function MobileFrame({ t, children, tab, onTab }: { t: ContributionsTokens; children: React.ReactNode; tab?: MobileTab; onTab?: (tab: MobileTab) => void }) {
  const tabs: { key: MobileTab; label: string }[] = [
    { key: 'drive', label: 'Drive' },
    { key: 'contribute', label: 'Contribute' },
    { key: 'history', label: 'My history' },
  ];
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px 10px', background: t.SURFACE, borderBottom: `1px solid ${t.BORDER_SOLID}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: t.TITLE }}>Contributions</span>
        </div>
        <div style={{ fontSize: 12, color: t.MUTED }}>Community support drive</div>
      </div>
      {tab && onTab && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.BORDER_SOLID}`, flexShrink: 0 }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onTab(key)}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === key ? 700 : 400, color: tab === key ? t.ACCENT : t.MUTED, borderBottom: tab === key ? `2px solid ${t.ACCENT}` : '2px solid transparent' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function ErrorState({ t, message, onRetry, isMobile }: { t: ContributionsTokens; message: string; onRetry: () => void; isMobile: boolean }) {
  const body = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', gap: 14 }}>
      <Heart size={28} color={t.ACCENT} />
      <p style={{ margin: 0, fontSize: 14, color: t.MUTED, maxWidth: 360 }}>{message}</p>
      <button type="button" onClick={onRetry} style={{ padding: '9px 22px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  );
  return isMobile ? (
    <MobileFrame t={t}>{body}</MobileFrame>
  ) : (
    <div style={{ display: 'flex', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT }}>{body}</div>
  );
}
