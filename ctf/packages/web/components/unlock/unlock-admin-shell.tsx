'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unlock, Key, CheckCircle, XCircle, Ban } from 'lucide-react';
import type { UnlockDashboardSnapshot, UnlockSubmission } from 'lib/unlock/types';

// Admin design tokens (shared admin look from the design system). Unlock accent is purple.
const COLOR = '#C084FC';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

type ReviewStatus = UnlockSubmission['reviewStatus'];
type Tab = 'pending' | 'all';

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)', label: 'pending' },
  approved: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)', label: 'approved' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.3)', label: 'rejected' },
  spam: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)', label: 'spam' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 92, padding: '10px 12px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? TEXT }}>{value}</div>
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function UnlockAdminShell({
  dashboard,
  submissions: initialSubmissions,
}: {
  dashboard: UnlockDashboardSnapshot;
  submissions: UnlockSubmission[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = tab === 'pending' ? submissions.filter((s) => s.reviewStatus === 'pending') : submissions;

  async function review(id: number, reviewStatus: ReviewStatus) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/unlock/admin/submissions/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ reviewStatus }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { reason?: string; code?: string } | null;
        setError(data?.reason ?? data?.code ?? `Review failed (${res.status}).`);
        return;
      }
      // Optimistically reflect the decision, then refresh so the snapshot counts update too.
      setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, reviewStatus } : s)));
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Unlock size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Unlock Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Quora verification queue</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <StatBlock label="Pending" value={dashboard.pendingCount} accent="#F59E0B" />
          <StatBlock label="Approved" value={dashboard.approvedCount} accent="#22C55E" />
          <StatBlock label="Rejected" value={dashboard.rejectedCount} accent="#EF4444" />
          <StatBlock label="Spam" value={dashboard.spamCount} />
          <StatBlock label="Support-only" value={dashboard.lockedSupportOnlyCount} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['pending', 'all'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              style={{ padding: '6px 16px', borderRadius: 8, background: tab === t ? COLOR : SURFACE, border: `1px solid ${tab === t ? COLOR : BORDER}`, color: tab === t ? '#fff' : SUBTLE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {t === 'pending' ? 'Pending' : 'All submissions'}
            </button>
          ))}
        </div>

        {error ? (
          <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>{error}</div>
        ) : null}

        {visible.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
            {tab === 'pending' ? 'No submissions waiting for review.' : 'No submissions yet.'}
          </div>
        ) : (
          visible.map((s) => {
            const busy = busyId === s.id;
            return (
              <div key={s.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Key size={14} color={COLOR} />
                  <a href={s.quoraProfileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: TEXT, flex: 1, wordBreak: 'break-all' }}>
                    {s.quoraProfileUrl}
                  </a>
                  <StatusPill status={s.reviewStatus} />
                </div>
                <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 4 }}>User: {s.userId}</div>
                <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 10 }}>
                  Submitted {new Date(s.createdAt).toLocaleDateString()} · window expires {new Date(s.unlockWindowExpiresAt).toLocaleDateString()} · tier {s.accessTier}
                </div>
                {s.reviewStatus === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" disabled={busy} onClick={() => review(s.id, 'approved')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button type="button" disabled={busy} onClick={() => review(s.id, 'rejected')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      <XCircle size={13} /> Reject
                    </button>
                    <button type="button" disabled={busy} onClick={() => review(s.id, 'spam')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(107,114,128,0.12)', border: '1px solid rgba(107,114,128,0.3)', color: '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      <Ban size={13} /> Spam
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        <p style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6, marginTop: 16 }}>
          Approving grants full access and mints the ServiceCredits verification reward. Rejecting or marking spam keeps the member on support-only access.
        </p>
      </div>
    </div>
  );
}
