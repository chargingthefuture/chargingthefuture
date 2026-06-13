'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Coins } from 'lucide-react';

// Admin design tokens (shared admin look). GDP accent is cyan.
const COLOR = '#06B6D4';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

type GdpReport = {
  publication: { id: string; weekStartDate: string; title: string; summary: string; status: string };
  metrics: unknown[];
} | null;

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

function StatBlock({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: '12px 14px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? TEXT, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function GdpAdminShell({ report }: { report: GdpReport }) {
  const router = useRouter();
  const [form, setForm] = useState({ weekStartDate: '', title: '', summary: '', publish: false, legalApproved: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (!form.weekStartDate || !form.title.trim() || !form.summary.trim()) {
      setError('Week start date, title, and summary are required.');
      return;
    }
    if (form.publish && !form.legalApproved) {
      setError('Publishing requires legal approval — tick "Legal approved" to publish.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/gdp/admin/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ weekStartDate: form.weekStartDate, title: form.title.trim(), summary: form.summary.trim(), publish: form.publish, legalApproved: form.legalApproved }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string; reason?: string } | null;
        setError(data?.message ?? data?.reason ?? `Save failed (${res.status}).`);
        return;
      }
      setMessage(form.publish ? 'Publication published.' : 'Draft saved.');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>GDP Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Publication governance</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Latest publication */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatBlock label="Latest published report" value={report?.publication.title ?? 'None yet'} accent={COLOR} />
          <StatBlock label="Metrics in report" value={report?.metrics.length ?? 0} />
          <StatBlock label="Week" value={report?.publication.weekStartDate ?? '—'} />
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: COLOR }}>{message}</div> : null}

        {/* Create / update weekly publication */}
        <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Weekly publication</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 10 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Week start date</span>
              <input type="date" value={form.weekStartDate} onChange={(e) => setForm((f) => ({ ...f, weekStartDate: e.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Title</span>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Report title" style={fieldStyle} />
            </label>
          </div>
          <textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Summary" rows={3} style={{ ...fieldStyle, resize: 'none', marginBottom: 12 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: SUBTLE }}>
              <input type="checkbox" checked={form.publish} onChange={(e) => setForm((f) => ({ ...f, publish: e.target.checked }))} /> Publish now
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: form.publish ? TEXT : SUBTLE }}>
              <input type="checkbox" checked={form.legalApproved} onChange={(e) => setForm((f) => ({ ...f, legalApproved: e.target.checked }))} /> Legal approved
            </label>
          </div>
          <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 12 }}>Publishing requires legal approval. Without &ldquo;Publish now&rdquo; the report is saved as a draft.</div>
          <button type="button" disabled={busy} onClick={() => void submit()} style={{ padding: '11px 18px', borderRadius: 10, background: busy ? `${COLOR}66` : COLOR, border: 'none', color: '#04243a', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Saving…' : form.publish ? 'Publish report' : 'Save draft'}
          </button>
        </div>

        {/* Currency rates */}
        <Link href="/admin/gdp/rates" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, textDecoration: 'none', color: TEXT }}>
          <Coins size={18} color={COLOR} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Currency rate factors</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Owner-curated USD factors used only to roll volume into the USD GDP estimate — never per-wallet or redemption values.</div>
          </div>
          <span style={{ color: COLOR, fontSize: 18 }}>›</span>
        </Link>
      </div>
    </div>
  );
}
