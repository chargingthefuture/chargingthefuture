'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { WorkforceConfig, WorkforceDashboard } from 'lib/workforce/types';

// Admin design tokens (shared admin look). Workforce accent is orange.
const COLOR = '#F97316';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

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
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? TEXT }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? '1'}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
        style={fieldStyle}
      />
      {hint ? <span style={{ display: 'block', fontSize: 11, color: SUBTLE, marginTop: 4 }}>{hint}</span> : null}
    </label>
  );
}

async function adminMutate(url: string, method: 'PUT', body?: unknown): Promise<{ ok: boolean; message?: string }> {
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
  dashboard: WorkforceDashboard;
  config: WorkforceConfig;
}) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [config, setConfig] = useState({
    population: initialConfig.population,
    participationRate: initialConfig.participationRate,
    minRecruitable: initialConfig.minRecruitable,
    maxRecruitable: initialConfig.maxRecruitable,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await adminMutate('/api/workforce/admin/config', 'PUT', config);
    if (res.ok) {
      setMessage('Config saved.');
      router.refresh();
    } else {
      setError(res.message ?? 'Action failed.');
    }
    setBusy(false);
  }

  const workforceTotal = Math.round(config.population * config.participationRate);

  return (
    <div
      style={{
        ...(isMobile ? { minHeight: '100dvh' } : { height: '100dvh', overflowY: 'auto' }),
        background: BG,
        color: TEXT,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Workforce Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Population model</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatBlock label="Workforce total" value={dashboard.workforceTotal} accent={COLOR} />
          <StatBlock label="Headcount target" value={dashboard.totalHeadcountTarget} accent="#EF4444" />
          <StatBlock label="Recruited" value={dashboard.recruitedTotal} accent="#22C55E" />
          <StatBlock label="Directory members" value={dashboard.totalMembers} />
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: COLOR }}>{message}</div> : null}

        {/* Config — workforce population model. Read-only over Directory/Skills Taxonomy; only this
            workforce-owned config is editable. */}
        <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Config</div>
          <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 14 }}>
            Demand is population × participation rate, distributed across sectors by their Skills Taxonomy
            workforce share. Current workforce total: <span style={{ color: TEXT, fontWeight: 700 }}>{workforceTotal.toLocaleString()}</span>.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <NumberField label="Population" hint="Survivor population baseline" value={config.population} onChange={(v) => setConfig((c) => ({ ...c, population: v }))} />
            <NumberField label="Participation rate" hint="0–1 (e.g. 0.5)" step="0.01" value={config.participationRate} onChange={(v) => setConfig((c) => ({ ...c, participationRate: v }))} />
            <NumberField label="Min recruitable" value={config.minRecruitable} onChange={(v) => setConfig((c) => ({ ...c, minRecruitable: v }))} />
            <NumberField label="Max recruitable" value={config.maxRecruitable} onChange={(v) => setConfig((c) => ({ ...c, maxRecruitable: v }))} />
          </div>
          <button type="button" disabled={busy} onClick={() => void save()} style={{ padding: '11px 18px', borderRadius: 10, background: busy ? `${COLOR}66` : COLOR, border: 'none', color: '#3a1d05', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Saving…' : 'Save config'}
          </button>
        </div>
      </div>
    </div>
  );
}
