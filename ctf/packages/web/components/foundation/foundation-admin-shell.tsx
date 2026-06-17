'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import type { FoundationCapacityPolicy } from 'lib/foundation/types';

// Admin design tokens (shared admin look). Foundation accent is amber.
const COLOR = '#F59E0B';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

type FoundationAdminDashboard = {
  providersTotal: number;
  threadsTotal: number;
  quotesTotal: number;
  activeCallsTotal: number;
  pendingNotificationsTotal: number;
  generatedAtIso: string;
};

type QuotaState = FoundationCapacityPolicy['quotaState'];

const QUOTA_STATES: { value: QuotaState; color: string }[] = [
  { value: 'green', color: '#22C55E' },
  { value: 'yellow', color: '#EAB308' },
  { value: 'orange', color: '#F97316' },
  { value: 'red', color: '#EF4444' },
];

const fieldStyle = {
  width: '100%',
  padding: '9px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 14,
  color: TEXT,
  outline: 'none',
  boxSizing: 'border-box',
} as const;

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110, padding: '12px 14px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? TEXT }}>{value}</div>
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

type NumericPolicyKey =
  | 'maxActiveThreadsPerUser'
  | 'maxMessagesPerMinute'
  | 'maxSearchesPerMinute'
  | 'maxQuoteTransitionsPerMinute'
  | 'maxCallDurationMinutes';

const NUMERIC_FIELDS: { key: NumericPolicyKey; label: string }[] = [
  { key: 'maxActiveThreadsPerUser', label: 'Max active threads / user' },
  { key: 'maxMessagesPerMinute', label: 'Max messages / min' },
  { key: 'maxSearchesPerMinute', label: 'Max searches / min' },
  { key: 'maxQuoteTransitionsPerMinute', label: 'Max quote transitions / min' },
  { key: 'maxCallDurationMinutes', label: 'Max call duration (min)' },
];

export function FoundationAdminShell({
  dashboard,
  policy,
}: {
  dashboard: FoundationAdminDashboard;
  policy: FoundationCapacityPolicy;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    maxActiveThreadsPerUser: policy.maxActiveThreadsPerUser,
    maxMessagesPerMinute: policy.maxMessagesPerMinute,
    maxSearchesPerMinute: policy.maxSearchesPerMinute,
    maxQuoteTransitionsPerMinute: policy.maxQuoteTransitionsPerMinute,
    maxCallDurationMinutes: policy.maxCallDurationMinutes,
    quotaState: policy.quotaState,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setNumber(key: NumericPolicyKey, raw: string) {
    const next = Math.max(0, Math.floor(Number(raw) || 0));
    setForm((prev) => ({ ...prev, [key]: next }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/foundation/admin/capacity-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string; reason?: string } | null;
        setError(data?.message ?? data?.reason ?? `Save failed (${res.status}).`);
        return;
      }
      setMessage('Capacity policy saved.');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Foundation Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Capacity and rate-limit safeguards</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <StatBlock label="Providers" value={dashboard.providersTotal} accent={COLOR} />
          <StatBlock label="Threads" value={dashboard.threadsTotal} />
          <StatBlock label="Quote requests" value={dashboard.quotesTotal} />
          <StatBlock label="Active calls" value={dashboard.activeCallsTotal} />
          <StatBlock label="Pending notifications" value={dashboard.pendingNotificationsTotal} accent="#F59E0B" />
        </div>
        <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 20 }}>Snapshot generated {new Date(dashboard.generatedAtIso).toLocaleString()}</div>

        {/* Capacity policy */}
        <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Capacity policy</div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Quota state</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {QUOTA_STATES.map((q) => {
                const active = form.quotaState === q.value;
                return (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, quotaState: q.value }))}
                    aria-pressed={active}
                    style={{ padding: '6px 14px', borderRadius: 8, textTransform: 'capitalize', background: active ? `${q.color}22` : 'transparent', border: `1px solid ${active ? q.color : BORDER}`, color: active ? q.color : SUBTLE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {q.value}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {NUMERIC_FIELDS.map((f) => (
              <label key={f.key} style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>{f.label}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form[f.key]}
                  onChange={(e) => setNumber(f.key, e.target.value)}
                  style={fieldStyle}
                />
              </label>
            ))}
          </div>

          {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
          {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: COLOR }}>{message}</div> : null}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{ padding: '11px 18px', borderRadius: 10, background: saving ? `${COLOR}66` : COLOR, border: 'none', color: '#06210F', fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save policy'}
          </button>
        </div>
      </div>
    </div>
  );
}
