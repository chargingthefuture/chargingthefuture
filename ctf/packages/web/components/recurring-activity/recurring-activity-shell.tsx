'use client';

import { useCallback, useEffect, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { AppLoading } from '@/components/shared/app-loading';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { RefreshButton } from '@/components/shared/refresh-button';
import {
  COMMUNITY_LINE,
  CSRF_HEADERS,
  FONT_FAMILY,
  getRecurringActivityTokens,
  type ActivitiesResponse,
  type Activity,
  type CurrenciesResponse,
  type Currency,
  type RecurringActivityTokens,
  type RecurringActivityVisibility,
} from './recurring-activity-shared';
import { RecurringActivityList } from './recurring-activity-list';
import { RecurringActivityCreateForm, type CreateActivityInput } from './recurring-activity-create-form';

type ActionKind = 'confirm' | 'decline' | 'end' | 'visibility';

export function RecurringActivityShell() {
  const { theme } = useTheme();
  const t = getRecurringActivityTokens(theme);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [busy, setBusy] = useState<{ id: string; action: ActionKind } | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal, background = false) => {
    // A background reload (the header refresh button) keeps the current screen on
    // display instead of flashing the full-screen loading state.
    if (!background) setLoading(true);
    setError(null);
    try {
      const [activitiesRes, currenciesRes] = await Promise.all([
        fetch('/api/recurring-activity', { cache: 'no-store', signal }),
        fetch('/api/currencies', { cache: 'no-store', signal }),
      ]);
      if (!activitiesRes.ok) {
        throw new Error('We could not load your ongoing activities. Try again in a moment.');
      }
      const activitiesData = (await activitiesRes.json()) as ActivitiesResponse;
      const currenciesData = currenciesRes.ok
        ? ((await currenciesRes.json()) as CurrenciesResponse)
        : { ok: false as const };
      if (signal?.aborted) {
        return;
      }
      setActivities(activitiesData.activities ?? []);
      setCurrencies(currenciesData.currencies ?? []);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        return;
      }
      setError(e instanceof Error ? e.message : 'We could not load your ongoing activities.');
    } finally {
      if (!signal?.aborted && !background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const create = useCallback(
    async (input: CreateActivityInput) => {
      setSubmitting(true);
      setSubmitError(null);
      setJustCreated(false);
      try {
        const res = await fetch('/api/recurring-activity', {
          method: 'POST',
          headers: CSRF_HEADERS,
          body: JSON.stringify(input),
        });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.message ?? 'We could not record that activity. Try again in a moment.');
        }
        setJustCreated(true);
        await loadData();
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'We could not record that activity.');
      } finally {
        setSubmitting(false);
      }
    },
    [loadData],
  );

  const runAction = useCallback(
    async (id: string, action: ActionKind, path: string, body?: Record<string, unknown>) => {
      setBusy({ id, action });
      try {
        const res = await fetch(`/api/recurring-activity/${id}/${path}`, {
          method: 'POST',
          headers: CSRF_HEADERS,
          body: JSON.stringify(body ?? {}),
        });
        if (!res.ok) {
          throw new Error('That action did not go through. Try again in a moment.');
        }
        await loadData();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That action did not go through.');
      } finally {
        setBusy(null);
      }
    },
    [loadData],
  );

  const onConfirm = useCallback((id: string) => void runAction(id, 'confirm', 'confirm'), [runAction]);
  const onDecline = useCallback((id: string) => void runAction(id, 'decline', 'decline'), [runAction]);
  const onEnd = useCallback((id: string) => void runAction(id, 'end', 'end'), [runAction]);
  const onVisibility = useCallback(
    (id: string, visibility: RecurringActivityVisibility) =>
      void runAction(id, 'visibility', 'visibility', { visibility }),
    [runAction],
  );

  if (loading && activities.length === 0 && currencies.length === 0) {
    return <AppLoading />;
  }

  if (error && activities.length === 0) {
    return <ErrorState t={t} message={error} onRetry={() => void loadData()} isMobile={true} />;
  }

  const content = (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.TITLE }}>Recurring Activity</h1>
          <RefreshButton onRefresh={() => loadData(undefined, true)} title="Refresh" />
        </div>
        <p style={{ margin: 0, fontSize: 13, color: t.MUTED, lineHeight: 1.7 }}>
          Acknowledge the ongoing ties you share with another member. This is recognition, never a bill —
          and it is yours to keep private.
        </p>
      </header>

      {justCreated ? (
        <div
          style={{
            background: `${t.ACCENT}12`,
            border: `1px solid ${t.ACCENT}40`,
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: t.TEXT,
            lineHeight: 1.6,
          }}
        >
          {COMMUNITY_LINE}
        </div>
      ) : null}

      <div style={{ marginBottom: 24 }}>
        <RecurringActivityCreateForm
          currencies={currencies}
          t={t}
          submitting={submitting}
          error={submitError}
          onSubmit={create}
        />
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 12 }}>Your ongoing activities</div>
      <RecurringActivityList
        activities={activities}
        currencies={currencies}
        t={t}
        busy={busy}
        onConfirm={onConfirm}
        onDecline={onDecline}
        onEnd={onEnd}
        onVisibility={onVisibility}
      />
    </div>
  );

  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <MobileScreenHeader title="Recurring Activity" accent={t.ACCENT} icon={<HeartHandshake size={18} color={t.ACCENT} />} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 32px' }}>{content}</div>
    </div>
  );
}

function ErrorState({
  t,
  message,
  onRetry,
}: {
  t: RecurringActivityTokens;
  message: string;
  onRetry: () => void;
  isMobile: boolean;
}) {
  const body = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', gap: 14 }}>
      <HeartHandshake size={28} color={t.ACCENT} />
      <p style={{ margin: 0, fontSize: 14, color: t.MUTED, maxWidth: 360 }}>{message}</p>
      <button type="button" onClick={onRetry} style={{ padding: '9px 22px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#0F1117', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        Try again
      </button>
    </div>
  );
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
      <MobileScreenHeader title="Recurring Activity" accent={t.ACCENT} icon={<HeartHandshake size={18} color={t.ACCENT} />} />
      {body}
    </div>
  );
}
