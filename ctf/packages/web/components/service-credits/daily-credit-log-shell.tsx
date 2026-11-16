'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy, Coins } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { Pager } from '@/components/shared/pager';
import { useTheme } from '@/hooks/useTheme';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import type { DailyCreditLogRow, DailyCreditSummaries } from 'lib/today/daily-credit/audit-summary';
import { dailyCreditLogAsPlainText } from 'lib/today/daily-credit/audit-text';
import { getServiceCreditsTokens } from './sc-shared';
import { DailyCreditRowCard, DailyCreditSummarySections } from './daily-credit-log-parts';

type LogPage = {
  page: number;
  pageCount: number;
  total: number;
  rows: DailyCreditLogRow[];
  summaries: DailyCreditSummaries;
  names: Record<string, string | null>;
  namesUnavailable: boolean;
};

// Admin-only, read-only audit log of the day's credit card on Today. ServiceCredits are an internal
// credits unit, not money.
export function DailyCreditLogShell() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const [page, setPage] = useState(1);
  const [log, setLog] = useState<LogPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (target: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/service-credits/admin/daily-credit-log?page=${target}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(await responseFailureText(res, 'Could not load the daily credit log.'));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as Partial<LogPage> & { ok?: boolean; message?: string };
      if (!data.ok || !data.rows || !data.summaries) {
        setError(data.message ?? 'Could not load the daily credit log: the response carried no rows.');
        return;
      }
      setLog(data as LogPage);
    } catch (caught) {
      setError(failureText(caught, { area: 'service-credits', op: 'daily_credit_log_load', fallback: 'Could not load the daily credit log.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const nameOf = (userId: string) => log?.names[userId] ?? `${userId.slice(0, 10)}…`;

  const onCopy = async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(dailyCreditLogAsPlainText({ ...log, nameOf }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
    }
  };

  return (
    <main style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Figtree Variable',system-ui,sans-serif" }}>
      <MobileScreenHeader title="Daily credit log" accent={t.ACCENT} backHref="/admin/service-credits" icon={<Coins size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 16px 40px' }}>
        <p style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.6, margin: '0 0 14px' }}>
          Every day&apos;s credit card on Today, newest first: who asked, who answered I can help in the
          order they answered, who the asker picked, and whether the credit was granted or held until
          Unlock. A card outlined in amber is one where the asker picked the same helper three or more
          times. Read the rows; a count alone is not a finding.
        </p>

        {error ? (
          <p role="alert" style={{ fontSize: 13, color: '#F87171', margin: '0 0 14px' }}>{error}</p>
        ) : null}
        {loading && !log ? <p style={{ fontSize: 13, color: t.SUBTLE }}>Loading the log…</p> : null}

        {log ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: t.SUBTLE }}>{log.total} days in all</span>
              <button
                type="button"
                onClick={() => void onCopy()}
                disabled={log.rows.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: t.ACCENT, color: '#0B0B0F', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <ClipboardCopy size={15} aria-hidden="true" />
                {copied ? 'Copied' : 'Copy this page'}
              </button>
            </div>
            {log.namesUnavailable ? (
              <p style={{ fontSize: 11, color: '#F59E0B', margin: '0 0 10px' }}>Usernames could not be loaded, so the rows show account ids instead.</p>
            ) : null}
            {log.rows.length === 0 ? (
              <p style={{ fontSize: 13, color: t.SUBTLE }}>No day has had a credit card yet.</p>
            ) : (
              log.rows.map((row) => <DailyCreditRowCard key={row.day} t={t} row={row} nameOf={nameOf} />)
            )}
            <Pager page={log.page} pageCount={log.pageCount} loading={loading} onPageChange={setPage} accent={t.ACCENT} subtle={t.SUBTLE} border={t.BORDER_SOLID} />
            <DailyCreditSummarySections t={t} summaries={log.summaries} nameOf={nameOf} />
          </>
        ) : null}
      </div>
    </main>
  );
}
