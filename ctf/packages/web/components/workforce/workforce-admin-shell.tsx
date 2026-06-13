'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, RefreshCw, Download } from 'lucide-react';
import type { WorkforceConfig } from 'lib/workforce/types';

// Admin design tokens (shared admin look). Workforce accent is orange.
const COLOR = '#F97316';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

type WorkforceAdminDashboard = {
  workforceTotal: number;
  recruitedTotal: number;
  occupationsTotal: number;
  activeAnnouncementsTotal: number;
};

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: SUBTLE }}>{hint}</div>
      </div>
      <button type="button" onClick={() => onChange(!value)} aria-pressed={value} style={{ padding: '6px 14px', borderRadius: 8, background: value ? COLOR : 'transparent', border: `1px solid ${value ? COLOR : BORDER}`, color: value ? '#3a1d05' : SUBTLE, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        {value ? 'On' : 'Off'}
      </button>
    </div>
  );
}

async function adminMutate(url: string, method: 'POST' | 'PUT', body?: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { message?: string; reason?: string; code?: string } | null;
    return { ok: false, message: data?.message ?? data?.reason ?? data?.code ?? `Request failed (${res.status}).` };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}

export function WorkforceAdminShell({
  dashboard,
  config: initialConfig,
}: {
  dashboard: WorkforceAdminDashboard;
  config: WorkforceConfig;
}) {
  const router = useRouter();
  const [config, setConfig] = useState({
    exportsEnabled: initialConfig.exportsEnabled,
    killSwitchEnabled: initialConfig.killSwitchEnabled,
    reportWeekTimezone: initialConfig.reportWeekTimezone,
    reportWeekStartDow: initialConfig.reportWeekStartDow,
  });
  const [busy, setBusy] = useState<null | 'save' | 'recompute' | 'sync'>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(kind: 'save' | 'recompute' | 'sync') {
    if (busy) return;
    setBusy(kind);
    setError(null);
    setMessage(null);
    let res: { ok: boolean; message?: string };
    if (kind === 'save') {
      res = await adminMutate('/api/workforce/admin/config', 'PUT', config);
    } else if (kind === 'recompute') {
      res = await adminMutate('/api/workforce/admin/recompute', 'POST', {});
    } else {
      res = await adminMutate('/api/workforce/admin/sync', 'POST', {});
    }
    if (res.ok) {
      setMessage(kind === 'save' ? 'Config saved.' : kind === 'recompute' ? 'Recompute started.' : 'Sync started.');
      router.refresh();
    } else {
      setError(res.message ?? 'Action failed.');
    }
    setBusy(null);
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
            <div style={{ fontSize: 17, fontWeight: 800 }}>Workforce Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Config and operations</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatBlock label="Workforce" value={dashboard.workforceTotal} accent={COLOR} />
          <StatBlock label="Recruited" value={dashboard.recruitedTotal} accent="#22C55E" />
          <StatBlock label="Occupations" value={dashboard.occupationsTotal} />
          <StatBlock label="Active announcements" value={dashboard.activeAnnouncementsTotal} />
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: COLOR }}>{message}</div> : null}

        {/* Config */}
        <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Config</div>
          <ToggleRow label="Exports enabled" hint="Allow report exports (execution still deferred)." value={config.exportsEnabled} onChange={(v) => setConfig((c) => ({ ...c, exportsEnabled: v }))} />
          <ToggleRow label="Kill switch" hint="Pauses Workforce processing when on." value={config.killSwitchEnabled} onChange={(v) => setConfig((c) => ({ ...c, killSwitchEnabled: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Report week timezone</span>
              <input value={config.reportWeekTimezone} onChange={(e) => setConfig((c) => ({ ...c, reportWeekTimezone: e.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Week starts on</span>
              <select value={config.reportWeekStartDow} onChange={(e) => setConfig((c) => ({ ...c, reportWeekStartDow: Number(e.target.value) }))} style={fieldStyle}>
                {DOW_LABELS.map((label, dow) => (
                  <option key={dow} value={dow}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" disabled={busy !== null} onClick={() => void run('save')} style={{ padding: '11px 18px', borderRadius: 10, background: busy ? `${COLOR}66` : COLOR, border: 'none', color: '#3a1d05', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy === 'save' ? 'Saving…' : 'Save config'}
          </button>
        </div>

        {/* Operations */}
        <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Operations</div>
          <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 14 }}>Recompute regenerates derived figures; sync pulls the latest source data.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy !== null} onClick={() => void run('recompute')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
              <RefreshCw size={14} /> {busy === 'recompute' ? 'Recomputing…' : 'Recompute'}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void run('sync')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
              <Download size={14} /> {busy === 'sync' ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
