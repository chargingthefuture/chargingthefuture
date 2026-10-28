'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import {
  FONT_FAMILY,
  getContributionsTokens,
  type ContributionsTokens,
  type SubmissionCreateResponse,
  type SubmissionsResponse,
} from './contributions-shared';
import { AppLoading } from '@/components/shared/app-loading';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginAdminButton } from '@/components/shared/plugin-admin-button';
import { RefreshButton } from '@/components/shared/refresh-button';
import { ContributionsGiftForm } from './contributions-gift-form';
import { ContributionsHistoryList, ContributionsEmptyHistory } from './contributions-history';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { reportError } from 'lib/observability/report';

type MobileTab = 'contribute' | 'history';

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' } as const;

const LOAD_FALLBACK = 'We could not load Contributions. Try again in a moment.';
const SUBMIT_FALLBACK = 'We could not record your gift card. Try again in a moment.';
const INTRO =
  'The app is free and stays free. Hosting is paid out of pocket, so if you are able, an Amazon gift card helps keep it online.';

// A failure the route answered. Its text is what the route said (member-safe), so the screen shows it
// as is; a request that never answered is a plain Error and goes through failureText, which reports it.
class RouteAnsweredError extends Error {}

async function fetchContributionsData(signal?: AbortSignal): Promise<SubmissionsResponse> {
  const res = await fetch('/api/contributions/submission', { cache: 'no-store', signal });
  if (!res.ok) {
    const text = await responseFailureText(res, LOAD_FALLBACK, 'member');
    reportError(new Error(`Contributions load answered HTTP ${res.status}: ${text}`), {
      area: 'contributions',
      op: 'member_load',
      extra: { url: res.url, status: res.status },
    });
    throw new RouteAnsweredError(text);
  }
  return (await res.json()) as SubmissionsResponse;
}

function useContributionsData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubmissionsResponse | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchContributionsData(signal);
      if (!signal?.aborted) setData(next);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(
        e instanceof RouteAnsweredError
          ? e.message
          : failureText(e, { area: 'contributions', op: 'member_load', fallback: LOAD_FALLBACK, audience: 'member' }),
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  return { loading, error, data, loadData };
}

async function postGiftCard(input: { claimedAmountUsd: number; code: string }): Promise<void> {
  const res = await fetch('/api/contributions/submission', { method: 'POST', headers: CSRF_HEADERS, body: JSON.stringify(input) });
  const payload = (await res.json().catch(() => null)) as SubmissionCreateResponse | null;
  if (!res.ok || !payload?.ok) {
    // Usually the member's own input (an amount out of range, a code that is not a code); the route
    // reports its own 5xx answers, so this shows the route's text without a second report.
    throw new RouteAnsweredError(payload?.message ?? SUBMIT_FALLBACK);
  }
}

export function ContributionsShell({ isAdmin }: { isAdmin?: boolean } = {}) {
  const { theme } = useTheme();
  const t = getContributionsTokens(theme);
  const { loading, error, data, loadData } = useContributionsData();

  const [mobileTab, setMobileTab] = useState<MobileTab>('contribute');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const onSubmit = useCallback(
    async (input: { claimedAmountUsd: number; code: string }) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await postGiftCard(input);
        await loadData();
        setFormKey((key) => key + 1);
        setMobileTab('history');
      } catch (e) {
        setSubmitError(
          e instanceof RouteAnsweredError
            ? e.message
            : failureText(e, { area: 'contributions', op: 'member_submit', fallback: SUBMIT_FALLBACK, audience: 'member' }),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [loadData],
  );

  if (loading && !data) {
    return <AppLoading />;
  }

  if (error || !data) {
    return <ErrorState t={t} message={error ?? LOAD_FALLBACK} onRetry={() => void loadData()} />;
  }

  return (
    <MobileFrame t={t} tab={mobileTab} onTab={setMobileTab} onRefresh={() => loadData()} isAdmin={isAdmin}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {mobileTab === 'contribute' ? (
          <>
            <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.7, margin: '0 0 16px' }}>{INTRO}</p>
            <ContributionsGiftForm
              key={formKey}
              t={t}
              open={data.open}
              minUsd={data.minUsd}
              maxUsd={data.maxUsd}
              creditsPerUsd={data.creditsPerUsd}
              submitting={submitting}
              error={submitError}
              onSubmit={(input) => void onSubmit(input)}
            />
          </>
        ) : data.submissions.length === 0 ? (
          <ContributionsEmptyHistory t={t} onContribute={() => setMobileTab('contribute')} />
        ) : (
          <ContributionsHistoryList submissions={data.submissions} t={t} />
        )}
      </div>
    </MobileFrame>
  );
}

// --- frames + chrome ---------------------------------------------------------------------------

function MobileFrame({ t, children, tab, onTab, onRefresh, isAdmin }: { t: ContributionsTokens; children: React.ReactNode; tab?: MobileTab; onTab?: (tab: MobileTab) => void; onRefresh?: () => Promise<void>; isAdmin?: boolean }) {
  const tabs: { key: MobileTab; label: string }[] = [
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
        <div style={{ fontSize: 12, color: t.MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Amazon gift cards, any time of year</div>
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

function ErrorState({ t, message, onRetry }: { t: ContributionsTokens; message: string; onRetry: () => void }) {
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
