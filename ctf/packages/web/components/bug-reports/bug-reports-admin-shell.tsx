'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type BugReportStatus = 'new' | 'held_for_review' | 'issue_created' | 'rejected' | 'resolved';

type AdminBugReport = {
  id: string;
  status: BugReportStatus;
  redactedMessage: string | null;
  redactedContext: string | null;
  riskFlags: string[];
  riskLevel: 'clean' | 'flagged' | 'unknown';
  pageUrl: string | null;
  pluginSlug: string | null;
  appVersion: string | null;
  triageRepo: string | null;
  issueNumber: number | null;
  issueUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type LoadState = 'loading' | 'ready' | 'error';

// Plain labels for why the sanitizer held a report, so an admin understands the flag at a glance.
const RISK_FLAG_LABEL: Record<string, string> = {
  pii_email: 'email removed',
  pii_phone: 'phone removed',
  pii_card: 'long number removed',
  secret_token: 'token-like string removed',
  abusive_language: 'abusive language',
};

const STATUS_LABEL: Record<BugReportStatus, string> = {
  held_for_review: 'Held for review',
  new: 'Queued for triage',
  issue_created: 'Sent to triage',
  rejected: 'Rejected',
  resolved: 'Resolved',
};

const STATUS_PILL_CLASS: Record<BugReportStatus, string> = {
  held_for_review: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  new: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  issue_created: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-muted text-muted-foreground border-border',
  resolved: 'bg-muted text-muted-foreground border-border',
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }
  return payload as T;
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown time';
  return new Date(then).toLocaleString();
}

export function BugReportsAdminShell() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [items, setItems] = useState<AdminBugReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await requestJson<{ items: AdminBugReport[] }>('/api/bug-reports/admin');
      setItems(payload.items);
      setLoadState('ready');
      setError(null);
    } catch (loadError) {
      setLoadState('error');
      setError(loadError instanceof Error ? loadError.message : 'Unable to load bug reports.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const heldCount = useMemo(() => items.filter((i) => i.status === 'held_for_review').length, [items]);

  const resolve = useCallback(
    async (id: string, action: 'release' | 'reject') => {
      const confirmText =
        action === 'release'
          ? 'Send this report to the triage repo? The redacted text becomes a triage issue on the next run (within 15 minutes).'
          : 'Reject this report? It will never be sent to triage.';
      if (typeof window !== 'undefined' && !window.confirm(confirmText)) {
        return;
      }

      setBusyId(id);
      setError(null);
      try {
        await requestJson(`/api/bug-reports/admin/${id}/resolve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
          body: JSON.stringify({ action }),
        });
        await refresh();
      } catch (resolveError) {
        setError(resolveError instanceof Error ? resolveError.message : 'Unable to resolve this report.');
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Bug Reports</h1>
          <span className="rounded border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-300">
            ADMIN
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Reports filed from inside the app. A report the safety check flagged is{' '}
          <span className="font-medium">held for review</span> and never sent to the triage repo on its own —
          release it to send the redacted copy to triage, or reject it. Only redacted text is shown here; the
          raw text stays in the database.
        </p>
        {loadState === 'ready' ? (
          <p className="text-sm text-muted-foreground">
            {heldCount > 0
              ? `${heldCount} report${heldCount === 1 ? '' : 's'} waiting for your review.`
              : 'No reports are waiting for review.'}
          </p>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300" role="status">
          {error}
        </div>
      ) : null}

      {loadState === 'loading' ? (
        <p className="text-sm text-muted-foreground">Loading reports…</p>
      ) : null}

      {loadState === 'ready' && items.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No bug reports yet. When someone files one from inside the app, it shows up here.
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((report) => {
          const canResolve = report.status === 'held_for_review' || report.status === 'new';
          return (
            <li key={report.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_PILL_CLASS[report.status]}`}
                >
                  {STATUS_LABEL[report.status]}
                </span>
                <span className="text-xs text-muted-foreground">{formatWhen(report.createdAt)}</span>
                {report.pluginSlug ? (
                  <span className="text-xs text-muted-foreground">· {report.pluginSlug}</span>
                ) : null}
              </div>

              <p className="whitespace-pre-wrap text-sm">{report.redactedMessage || '(no message)'}</p>

              {report.redactedContext ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  <span className="font-medium">What they were trying to do: </span>
                  {report.redactedContext}
                </p>
              ) : null}

              {report.riskFlags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {report.riskFlags.map((flag) => (
                    <span
                      key={flag}
                      className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300"
                    >
                      {RISK_FLAG_LABEL[flag] ?? flag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {report.pageUrl ? <span>Page: {report.pageUrl}</span> : null}
                {report.appVersion ? <span>App: {report.appVersion}</span> : null}
                {report.issueUrl ? (
                  <Link className="underline underline-offset-4" href={report.issueUrl} target="_blank" rel="noreferrer">
                    Triage issue #{report.issueNumber ?? '?'}
                  </Link>
                ) : null}
              </div>

              {canResolve ? (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void resolve(report.id, 'release')}
                    disabled={busyId === report.id}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {report.status === 'held_for_review' ? 'Release to triage' : 'Send to triage now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void resolve(report.id, 'reject')}
                    disabled={busyId === report.id}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <footer className="border-t pt-4 text-sm text-muted-foreground">
        <Link className="underline underline-offset-4" href="/admin">Back to admin</Link>
      </footer>
    </main>
  );
}
