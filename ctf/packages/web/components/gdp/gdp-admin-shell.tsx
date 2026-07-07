'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Coins } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { useTheme } from '@/hooks/useTheme';
import { getGdpTokens, type GdpTokens } from './gdp-shared';

type GdpReport = {
  publication: { id: string; weekStartDate: string; title: string; summary: string; status: string };
  metrics: unknown[];
} | null;

const fieldStyle = (t: GdpTokens) =>
  ({
    width: '100%',
    padding: '9px 12px',
    background: t.INPUT_BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    fontSize: 14,
    color: t.TITLE,
    outline: 'none',
    boxSizing: 'border-box',
  }) as const;

function StatBlock({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 130, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? t.TITLE, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function GdpAdminShell({ report }: { report: GdpReport }) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  const field = fieldStyle(t);
  const isMobile = useIsMobile();
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
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped and unreachable. On mobile the document
        // scrolls, so only set a min-height there. Matches the unlock / skills-hunt admin shells.
        ...(isMobile ? { minHeight: '100dvh' } : { height: '100dvh', overflowY: 'auto' }),
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="GDP Admin" accent={t.ACCENT} icon={<BarChart3 size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={18} color={t.ACCENT} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>GDP Admin</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Publication governance</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Latest publication */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatBlock label="Latest published report" value={report?.publication.title ?? 'None yet'} accent={t.ACCENT} />
          <StatBlock label="Metrics in report" value={report?.metrics.length ?? 0} />
          <StatBlock label="Week" value={report?.publication.weekStartDate ?? '—'} />
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: t.ACCENT }}>{message}</div> : null}

        {/* Create / update weekly publication */}
        <div style={{ padding: '16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Weekly publication</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 10 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Week start date</span>
              <input type="date" value={form.weekStartDate} onChange={(e) => setForm((f) => ({ ...f, weekStartDate: e.target.value }))} style={field} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>Title</span>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Report title" style={field} />
            </label>
          </div>
          <textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Summary" rows={3} style={{ ...field, resize: 'none', marginBottom: 12 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.MUTED }}>
              <input type="checkbox" checked={form.publish} onChange={(e) => setForm((f) => ({ ...f, publish: e.target.checked }))} /> Publish now
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: form.publish ? t.TITLE : t.MUTED }}>
              <input type="checkbox" checked={form.legalApproved} onChange={(e) => setForm((f) => ({ ...f, legalApproved: e.target.checked }))} /> Legal approved
            </label>
          </div>
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 12 }}>Publishing requires legal approval. Without &ldquo;Publish now&rdquo; the report is saved as a draft.</div>
          <button type="button" disabled={busy} onClick={() => void submit()} style={{ padding: '11px 18px', borderRadius: 10, background: busy ? `${t.ACCENT}66` : t.ACCENT, border: 'none', color: '#04243a', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Saving…' : form.publish ? 'Publish report' : 'Save draft'}
          </button>
        </div>

        {/* Currency rates */}
        <Link href="/admin/gdp/rates" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, textDecoration: 'none', color: t.TITLE }}>
          <Coins size={18} color={t.ACCENT} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Currency rate factors</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Owner-curated USD factors used only to roll volume into the USD GDP estimate — never per-wallet or redemption values.</div>
          </div>
          <span style={{ color: t.ACCENT, fontSize: 18 }}>›</span>
        </Link>
      </div>
    </div>
  );
}
