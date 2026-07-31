'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
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
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginAdminButton } from '@/components/shared/plugin-admin-button';
import { RefreshButton } from '@/components/shared/refresh-button';
import { goalsFromFundraiser, GoalRow } from './contributions-drive-progress';
import { ContributionPaths, type PathsProps, type SubmitGiftCardInput } from './contributions-paths';
import { ContributionsHistoryList, ContributionsEmptyHistory } from './contributions-history';
import { ContributionsConfirmation } from './contributions-confirmation';


type View = 'main' | 'confirmation';
type MobileTab = 'drive' | 'contribute' | 'history';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

// Fetches the drive and the member's submissions in parallel and parses both. Kept at module scope so
// the loadData callback stays small; it throws on a failed response and the caller handles aborts.
async function fetchContributionsData(
  signal?: AbortSignal,
): Promise<{ fundraiser: FundraiserResponse; submissions: ContributionSubmission[] }> {
  const [fundraiserRes, submissionsRes] = await Promise.all([
    fetch('/api/contributions/fundraiser', { cache: 'no-store', signal }),
    fetch('/api/contributions/submission', { cache: 'no-store', signal }),
  ]);
  if (!fundraiserRes.ok || !submissionsRes.ok) {
    throw new Error('We could not load the contribution drive. Try again in a moment.');
  }
  const fundraiserData = (await fundraiserRes.json()) as FundraiserResponse;
  const submissionsData = (await submissionsRes.json()) as SubmissionsResponse;
  return { fundraiser: fundraiserData, submissions: submissionsData.submissions ?? [] };
}

export function ContributionsShell({ isAdmin }: { isAdmin?: boolean } = {}) {
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
      const data = await fetchContributionsData(signal);
      if (signal?.aborted) {
        return;
      }
      setFundraiser(data.fundraiser);
      setSubmissions(data.submissions);
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
    return <ErrorState t={t} message={error ?? 'Drive unavailable.'} onRetry={() => void loadData()} isMobile={true} />;
  }

  const goals = goalsFromFundraiser(fundraiser.fundraiser);
  const githubStarAlreadyCredited = fundraiser.fundraiser.githubStarAlreadyCredited;

  if (view === 'confirmation') {
    const confirmation = (
      <ContributionsConfirmation
        t={t}
        isMobile={true}
        ownerSignalUrl={fundraiser.ownerSignalUrl}
        signalInstructions={fundraiser.signalInstructions}
        onViewHistory={() => {
          setView('main');
          setMobileTab('history');
        }}
        onBackToHub={() => setView('main')}
      />
    );
    return <MobileFrame t={t} isAdmin={isAdmin}>{confirmation}</MobileFrame>;
  }

  const pathsProps = {
    t,
    creditsPerUsd: fundraiser.creditsPerUsd,
    creditsPerAction: fundraiser.creditsPerActionSc,
    githubStarAlreadyCredited,
    submitting,
    error: submitError,
    onSubmitGiftCard,
    onSubmitQuora,
    onSubmitGithub,
  };

  return (
    <MobileFrame t={t} tab={mobileTab} onTab={setMobileTab} onRefresh={() => loadData()} isAdmin={isAdmin}>
      <MainTabContent
        t={t}
        mobileTab={mobileTab}
        goals={goals}
        pathsProps={pathsProps}
        submissions={submissions}
        onContribute={() => setMobileTab('contribute')}
      />
    </MobileFrame>
  );
}

// The three main-view tabs (drive progress, the contribute paths, and the member's history). Only the
// active tab's block renders; the others return nothing.
function MainTabContent({
  t,
  mobileTab,
  goals,
  pathsProps,
  submissions,
  onContribute,
}: {
  t: ContributionsTokens;
  mobileTab: MobileTab;
  goals: ReturnType<typeof goalsFromFundraiser>;
  pathsProps: PathsProps;
  submissions: ContributionSubmission[];
  onContribute: () => void;
}) {
  return (
    <>
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
            <ContributionsEmptyHistory t={t} onContribute={onContribute} />
          ) : (
            <ContributionsHistoryList submissions={submissions} t={t} />
          )}
        </div>
      )}
    </>
  );
}

// --- frames + chrome ---------------------------------------------------------------------------

function MobileFrame({ t, children, tab, onTab, onRefresh, isAdmin }: { t: ContributionsTokens; children: React.ReactNode; tab?: MobileTab; onTab?: (tab: MobileTab) => void; onRefresh?: () => Promise<void>; isAdmin?: boolean }) {
  const tabs: { key: MobileTab; label: string }[] = [
    { key: 'drive', label: 'Drive' },
    { key: 'contribute', label: 'Contribute' },
    { key: 'history', label: 'My history' },
  ];
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <MobileScreenHeader
        title="Contributions"
        accent={t.ACCENT}
        icon={<Gift size={18} color={t.ACCENT} />}
        actions={
          <>
            <PluginAdminButton href="/admin/contributions" isAdmin={isAdmin} accent={t.ACCENT} />
            {onRefresh ? <RefreshButton onRefresh={onRefresh} title="Refresh" /> : null}
          </>
        }
      />
      <div style={{ padding: '12px 16px 10px', background: t.SURFACE, borderBottom: `1px solid ${t.BORDER_SOLID}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: t.TITLE }}>Contributions</span>
        </div>
        <div style={{ fontSize: 12, color: t.MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Community support drive</div>
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

function ErrorState({ t, message, onRetry }: { t: ContributionsTokens; message: string; onRetry: () => void; isMobile: boolean }) {
  const body = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', gap: 14 }}>
      <Gift size={28} color={t.ACCENT} />
      <p style={{ margin: 0, fontSize: 14, color: t.MUTED, maxWidth: 360 }}>{message}</p>
      <button type="button" onClick={onRetry} style={{ padding: '9px 22px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  );
  return <MobileFrame t={t}>{body}</MobileFrame>;
}
