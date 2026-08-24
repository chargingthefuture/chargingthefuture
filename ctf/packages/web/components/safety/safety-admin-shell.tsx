'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { SafetyReportStatus } from 'lib/safety/constants';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { getSafetyTokens } from './safety-shared';

// Admin chrome (shared admin look, rule 131) comes from the theme tokens. Safety reports are
// cross-cutting platform safety tooling with no plugin accent, so the chrome uses the neutral
// admin indigo via getSafetyTokens; the open/alert state uses amber to read as "needs attention"
// without being alarming.

type AdminSafetyReport = {
  id: string;
  reporterUserId: string;
  reporterDisplayName: string;
  reportedUserId: string;
  reportedDisplayName: string;
  detail: string | null;
  status: SafetyReportStatus;
  createdAtIso: string;
  reviewedAtIso: string | null;
  reviewedByUserId: string | null;
  openReportsAboutReported: number;
};

type LoadState = 'loading' | 'ready' | 'error';

const STATUS_LABEL: Record<SafetyReportStatus, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  dismissed: 'Dismissed',
};

const STATUS_STYLE: Record<SafetyReportStatus, { bg: string; color: string; border: string }> = {
  open: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  reviewed: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  dismissed: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    // Defense in depth: this admin route returns controlled messages, but never render a raw server
    // string unbounded — cap the length so an unexpected message (e.g. a leaked internal detail)
    // cannot flood the UI verbatim.
    const safeMessage =
      typeof message === 'string' && message.trim() ? message.trim().slice(0, 300) : 'Request failed.';
    throw new Error(safeMessage);
  }
  return payload as T;
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown time';
  return new Date(then).toLocaleString();
}

function StatusPill({ status }: { status: SafetyReportStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getSafetyTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 120, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// The review / dismiss buttons for an open report. The busy-dependent cursor and opacity live here
// so the card does not repeat them per button.
function SafetyReviewActions({
  busy,
  onReviewed,
  onDismissed,
}: {
  busy: boolean;
  onReviewed: () => void;
  onDismissed: () => void;
}) {
  const { theme } = useTheme();
  const t = getSafetyTokens(theme);
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      <button
        type="button"
        onClick={onReviewed}
        disabled={busy}
        style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        Mark reviewed
      </button>
      <button
        type="button"
        onClick={onDismissed}
        disabled={busy}
        style={{ padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        Dismiss
      </button>
    </div>
  );
}

// One report row in the admin queue. A repeat offender (another open report about the same reported
// member) gets an amber border and a flag.
function SafetyReportCard({
  report,
  busy,
  onReview,
}: {
  report: AdminSafetyReport;
  busy: boolean;
  onReview: (id: string, action: 'reviewed' | 'dismissed') => void;
}) {
  const { theme } = useTheme();
  const t = getSafetyTokens(theme);
  const canAct = report.status === 'open';
  // A repeat offender: at least one OTHER open report about the same reported member
  // (openReportsAboutReported excludes this row, so > 0 means more than one open report).
  const isRepeat = report.openReportsAboutReported > 0;
  return (
    <div style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${isRepeat ? 'rgba(245,158,11,0.4)' : t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <StatusPill status={report.status} />
        <span style={{ fontSize: 12, color: t.MUTED }}>{formatWhen(report.createdAtIso)}</span>
        {isRepeat ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertTriangle size={12} /> {report.openReportsAboutReported} other open report{report.openReportsAboutReported === 1 ? '' : 's'} about this member
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 13, color: t.TITLE, lineHeight: 1.7 }}>
        <span style={{ color: t.MUTED }}>Reported member: </span>
        <span style={{ fontWeight: 700 }}>{report.reportedDisplayName}</span>
        <span style={{ color: t.MUTED }}> ({report.reportedUserId})</span>
      </div>
      <div style={{ fontSize: 13, color: t.TITLE, lineHeight: 1.7 }}>
        <span style={{ color: t.MUTED }}>Reported by: </span>
        <span style={{ fontWeight: 600 }}>{report.reporterDisplayName}</span>
        <span style={{ color: t.MUTED }}> ({report.reporterUserId})</span>
      </div>

      {report.detail ? (
        <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: t.TITLE, marginTop: 8, marginBottom: 0 }}>
          <span style={{ color: t.MUTED, fontWeight: 600 }}>What the reporter said: </span>
          {report.detail}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: t.MUTED, marginTop: 8, marginBottom: 0, fontStyle: 'italic' }}>
          No additional detail was provided.
        </p>
      )}

      {report.status !== 'open' && report.reviewedAtIso ? (
        <div style={{ fontSize: 12, color: t.MUTED, marginTop: 10 }}>
          {STATUS_LABEL[report.status]} {formatWhen(report.reviewedAtIso)}
          {report.reviewedByUserId ? ` by ${report.reviewedByUserId}` : ''}
        </div>
      ) : null}

      {canAct ? (
        <SafetyReviewActions
          busy={busy}
          onReviewed={() => onReview(report.id, 'reviewed')}
          onDismissed={() => onReview(report.id, 'dismissed')}
        />
      ) : null}
    </div>
  );
}

// Admin safety-report queue (issue #809, task 3). The only path by which a member block reaches the
// admin: a member who blocked someone and flagged it as a suspected predator / human trafficker. The
// owner reviews these so they can ban globally (the global ban itself is task 5 — this surface is
// read + triage only). Open reports surface first; a per-reported-member open count flags a repeat
// offender. Covers loading, error, empty, and populated states and is mobile-responsive (rows reflow
// at phone width). Ordinary blocks never appear here.
export function SafetyAdminShell() {
  const { theme } = useTheme();
  const t = getSafetyTokens(theme);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [reports, setReports] = useState<AdminSafetyReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await requestJson<{ reports: AdminSafetyReport[] }>('/api/safety/admin/reports');
      setReports(payload.reports);
      setLoadState('ready');
      setError(null);
    } catch (loadError) {
      setLoadState('error');
      setError(loadError instanceof Error ? loadError.message : 'Unable to load safety reports.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCount = useMemo(() => reports.filter((r) => r.status === 'open').length, [reports]);

  const review = useCallback(
    async (id: string, action: 'reviewed' | 'dismissed') => {
      const confirmText =
        action === 'reviewed'
          ? 'Mark this safety report reviewed? Use this once you have acted on it. Banning this member globally is a separate admin action.'
          : 'Dismiss this safety report? Use this if it is not a real safety concern.';
      if (typeof window !== 'undefined' && !window.confirm(confirmText)) {
        return;
      }

      setBusyId(id);
      setError(null);
      try {
        await requestJson(`/api/safety/admin/reports/${id}/review`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
          body: JSON.stringify({ action }),
        });
        await refresh();
      } catch (reviewError) {
        setError(reviewError instanceof Error ? reviewError.message : 'Unable to update this report.');
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return (
    <div
      style={{
        // At least one viewport tall, never exactly one: the document is the scroller at every
        // width, so a min-height fills a short page without hiding a long one's real length.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="Safety Admin" accent={t.ACCENT} icon={<ShieldAlert size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/" accent={t.ACCENT} label="App home" />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}
        <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, marginBottom: 16 }}>
          When a member blocks someone and flags them as a{' '}
          <span style={{ color: t.TITLE, fontWeight: 600 }}>suspected predator or human trafficker</span>, the
          report shows up here. Ordinary blocks are private and never appear. Review a report once you have
          acted on it, or dismiss it if it is not a real safety concern. Banning a member from the whole
          product is a separate admin action that arrives in a later change.
        </p>

        {/* Snapshot */}
        {loadState === 'ready' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <StatBlock label="Open reports" value={openCount} accent="#F59E0B" />
            <StatBlock label="Total reports" value={reports.length} />
          </div>
        ) : null}

        {error ? (
          <div role="status" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {loadState === 'loading' ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            Loading safety reports…
          </div>
        ) : null}

        {loadState === 'ready' && reports.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            No safety reports. When a member flags a block as a safety concern, it shows up here.
          </div>
        ) : null}

        {reports.map((report) => (
          <SafetyReportCard
            key={report.id}
            report={report}
            busy={busyId === report.id}
            onReview={(id, action) => void review(id, action)}
          />
        ))}
      </div>
    </div>
  );
}
