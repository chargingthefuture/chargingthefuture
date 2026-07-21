'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bug, ExternalLink } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getBugReportsTokens } from './bug-reports-shared';
import type { BugReportStatus, BugReportRiskLevel } from 'lib/bug-reports/constants';
import type { BugReportRiskFlag } from 'lib/bug-reports/sanitize';

// Admin chrome (shared admin look from the design system) comes from the theme tokens. Bug Reports
// is cross-cutting platform tooling with no plugin accent, so it uses the neutral admin indigo
// (rule 131) via getBugReportsTokens.

type AdminBugReport = {
  id: string;
  status: BugReportStatus;
  reporterUsername: string | null;
  reporterHandle: string;
  redactedMessage: string | null;
  redactedContext: string | null;
  riskFlags: BugReportRiskFlag[];
  riskLevel: BugReportRiskLevel;
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

const STATUS_STYLE: Record<BugReportStatus, { bg: string; color: string; border: string }> = {
  held_for_review: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  new: { bg: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: 'rgba(56,189,248,0.3)' },
  issue_created: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  rejected: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
  resolved: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
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

function StatusPill({ status }: { status: BugReportStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getBugReportsTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 120, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function BugReportsAdminShell() {
  const { theme } = useTheme();
  const t = getBugReportsTokens(theme);
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
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped and unreachable. On mobile the document
        // scrolls, so only set a min-height there. Matches the unlock / skills-hunt admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="Bug Reports Admin" accent={t.ACCENT} icon={<Bug size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bug size={18} color={t.ACCENT} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Bug Reports</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>In-app report triage</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, marginBottom: 16 }}>
          Reports filed from inside the app. A report the safety check flagged is{' '}
          <span style={{ color: t.TITLE, fontWeight: 600 }}>held for review</span> and never sent to the triage repo on its
          own — release it to send the redacted copy to triage, or reject it. Only redacted text is shown here; the raw
          text stays in the database.
        </p>

        {/* Snapshot */}
        {loadState === 'ready' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <StatBlock label="Held for review" value={heldCount} accent="#F59E0B" />
            <StatBlock label="Total reports" value={items.length} />
          </div>
        ) : null}

        {error ? (
          <div role="status" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {loadState === 'loading' ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            Loading reports…
          </div>
        ) : null}

        {loadState === 'ready' && items.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            No bug reports yet. When someone files one from inside the app, it shows up here.
          </div>
        ) : null}

        {items.map((report) => {
          // A held report can be released to triage; a new one is already queued for the drain,
          // so it only offers reject. Release on a new report would 409 (the update only matches
          // held_for_review), so the button is hidden there.
          const canRelease = report.status === 'held_for_review';
          const canReject = report.status === 'held_for_review' || report.status === 'new';
          const busy = busyId === report.id;
          return (
            <div key={report.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <StatusPill status={report.status} />
                <span style={{ fontSize: 12, color: t.MUTED }}>{formatWhen(report.createdAt)}</span>
                <span style={{ fontSize: 12, color: t.MUTED }}>· From: {report.reporterHandle}</span>
                {report.pluginSlug ? <span style={{ fontSize: 12, color: t.MUTED }}>· {report.pluginSlug}</span> : null}
              </div>

              <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: t.TITLE, margin: 0 }}>
                {report.redactedMessage || '(no message)'}
              </p>

              {report.redactedContext ? (
                <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: t.MUTED, marginTop: 8, marginBottom: 0 }}>
                  <span style={{ color: t.TITLE, fontWeight: 600 }}>What they were trying to do: </span>
                  {report.redactedContext}
                </p>
              ) : null}

              {report.riskFlags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {report.riskFlags.map((flag) => (
                    <span
                      key={flag}
                      style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
                    >
                      {RISK_FLAG_LABEL[flag] ?? flag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 10, fontSize: 12, color: t.MUTED }}>
                {report.pageUrl ? <span>Page: {report.pageUrl}</span> : null}
                {report.appVersion ? <span>App: {report.appVersion}</span> : null}
                {report.issueUrl ? (
                  <Link
                    href={report.issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: t.ACCENT, textDecoration: 'none' }}
                  >
                    <ExternalLink size={12} /> Triage issue #{report.issueNumber ?? '?'}
                  </Link>
                ) : null}
              </div>

              {canRelease || canReject ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {canRelease ? (
                    <button
                      type="button"
                      onClick={() => void resolve(report.id, 'release')}
                      disabled={busy}
                      style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                    >
                      Release to triage
                    </button>
                  ) : null}
                  {canReject ? (
                    <button
                      type="button"
                      onClick={() => void resolve(report.id, 'reject')}
                      disabled={busy}
                      style={{ padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                    >
                      Reject
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.BORDER_SOLID}`, fontSize: 13 }}>
          <Link href="/admin" style={{ color: t.ACCENT, textDecoration: 'none' }}>
            ← Back to admin
          </Link>
        </div>
      </div>
    </div>
  );
}
