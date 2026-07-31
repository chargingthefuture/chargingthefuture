'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, CheckCircle } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import type { TrustTransportIncident, TrustTransportMarketConfig } from 'lib/trust-transport/types';
import { TrustTransportAdminAccounts } from './trust-transport-admin-accounts';
import { getTrustTransportTokens, type TrustTransportTokens } from './tt-shared';

type AuditEvent = {
  id: string;
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  createdAtIso: string;
};

type Tab = 'incidents' | 'market' | 'audit' | 'accounts';

const SEVERITY_COLOR: Record<string, string> = {
  low: '#6B7280',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

const INCIDENT_STATUS_COLOR: Record<string, string> = {
  open: '#F59E0B',
  resolved: '#22C55E',
  dismissed: '#6B7280',
};

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${color}1f`, color, border: `1px solid ${color}4d`, textTransform: 'capitalize' }}>{label}</span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 110, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

const fieldStyle = (t: TrustTransportTokens) => ({
  width: 100,
  padding: '9px 12px',
  background: t.INPUT_BG,
  border: `1px solid ${t.BORDER_SOLID}`,
  borderRadius: 8,
  fontSize: 14,
  color: t.TITLE,
  outline: 'none',
  boxSizing: 'border-box',
} as const);

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

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: t.MUTED }}>{hint}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{ padding: '6px 14px', borderRadius: 8, background: value ? t.ACCENT : 'transparent', border: `1px solid ${value ? t.ACCENT : t.BORDER_SOLID}`, color: value ? '#04243a' : t.MUTED, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  );
}

function IncidentsPanel({ incidents, busy, onResolve }: { incidents: TrustTransportIncident[]; busy: boolean; onResolve: (id: string) => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  if (incidents.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>No incidents.</div>
    );
  }
  return (
    <>
      {incidents.map((i) => (
        <div key={i.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textTransform: 'capitalize' }}>{i.kind.replace('_', ' ')}</span>
            <Pill label={i.severity} color={SEVERITY_COLOR[i.severity] ?? t.MUTED} />
            <Pill label={i.status} color={INCIDENT_STATUS_COLOR[i.status] ?? t.MUTED} />
          </div>
          <div style={{ fontSize: 12, color: '#D1D5DB', marginBottom: 8 }}>{i.reason}</div>
          <div style={{ fontSize: 11, color: t.MUTED, marginBottom: i.status === 'open' ? 10 : 0 }}>
            Opened by {i.openedByUserId} · {new Date(i.createdAtIso).toLocaleDateString()}
          </div>
          {i.status === 'open' ? (
            <button type="button" disabled={busy} onClick={() => onResolve(i.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              <CheckCircle size={13} /> Resolve
            </button>
          ) : null}
        </div>
      ))}
    </>
  );
}

function MarketControlsPanel({
  config,
  onConfigChange,
  busy,
  onSave,
}: {
  config: TrustTransportMarketConfig;
  onConfigChange: (updater: (c: TrustTransportMarketConfig) => TrustTransportMarketConfig) => void;
  busy: boolean;
  onSave: () => void;
}) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ padding: '16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Market controls</div>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Max concurrent trips</div>
          <div style={{ fontSize: 12, color: t.MUTED }}>Per driver, at once.</div>
        </div>
        <input type="number" min={0} aria-label="Max concurrent trips" value={config.maxConcurrentTrips} onChange={(e) => onConfigChange((c) => ({ ...c, maxConcurrentTrips: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))} style={fieldStyle(t)} />
      </label>
      <ToggleRow label="Require proof on delivery" hint="Drivers must confirm delivery with proof." value={config.requireProofOnDelivery} onChange={(v) => onConfigChange((c) => ({ ...c, requireProofOnDelivery: v }))} />
      <ToggleRow label="Emergency freeze" hint="Pauses new trips network-wide when on." value={config.emergencyFreezeEnabled} onChange={(v) => onConfigChange((c) => ({ ...c, emergencyFreezeEnabled: v }))} />
      <button type="button" disabled={busy} onClick={onSave} style={{ marginTop: 4, padding: '11px 18px', borderRadius: 10, background: busy ? `${t.ACCENT}66` : t.ACCENT, border: 'none', color: '#04243a', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
        {busy ? 'Saving…' : 'Save market controls'}
      </button>
    </div>
  );
}

function AuditPanel({ auditEvents }: { auditEvents: AuditEvent[] }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  if (auditEvents.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>No audit events.</div>
    );
  }
  return (
    <>
      {auditEvents.map((e) => (
        <div key={e.id} style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{e.command}</span>
            <Pill label={e.policyStatus} color={e.policyStatus === 'allow' ? '#22C55E' : '#EF4444'} />
          </div>
          <div style={{ fontSize: 11, color: t.MUTED }}>{e.targetType} {e.targetId} · {new Date(e.createdAtIso).toLocaleString()}</div>
        </div>
      ))}
    </>
  );
}

export function TrustTransportAdminShell({
  incidents,
  marketConfig,
  auditEvents,
}: {
  incidents: TrustTransportIncident[];
  marketConfig: TrustTransportMarketConfig;
  auditEvents: AuditEvent[];
}) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('incidents');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [config, setConfig] = useState(marketConfig);

  const openIncidents = incidents.filter((i) => i.status === 'open').length;

  async function resolveIncident(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await adminMutate(`/api/trust-transport/admin/incidents/${id}/resolve`, 'POST', {});
    if (res.ok) {
      setMessage('Incident resolved.');
      router.refresh();
    } else {
      setError(res.message ?? 'Could not resolve the incident.');
    }
    setBusy(false);
  }

  async function saveMarketConfig() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await adminMutate('/api/trust-transport/admin/market-config', 'PUT', config);
    if (res.ok) {
      setMessage('Market controls saved.');
      router.refresh();
    } else {
      setError(res.message ?? 'Could not save market controls.');
    }
    setBusy(false);
  }

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
      <MobileScreenHeader title="TrustTransport Admin" accent={t.ACCENT} icon={<ShieldCheck size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/trust-transport" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}
        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatBlock label="Incidents" value={incidents.length} accent={t.ACCENT} />
          <StatBlock label="Open" value={openIncidents} accent="#F59E0B" />
          <StatBlock label="Audit events" value={auditEvents.length} />
          <StatBlock label="Max concurrent trips" value={config.maxConcurrentTrips} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['incidents', 'market', 'audit', 'accounts'] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              aria-pressed={tab === tabKey}
              style={{ padding: '6px 16px', borderRadius: 8, textTransform: 'capitalize', background: tab === tabKey ? t.ACCENT : t.SURFACE, border: `1px solid ${tab === tabKey ? t.ACCENT : t.BORDER_SOLID}`, color: tab === tabKey ? '#04243a' : t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {tabKey === 'market' ? 'Market controls' : tabKey}
            </button>
          ))}
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: t.ACCENT }}>{message}</div> : null}

        {tab === 'incidents' ? (
          <IncidentsPanel incidents={incidents} busy={busy} onResolve={(id) => void resolveIncident(id)} />
        ) : tab === 'market' ? (
          <MarketControlsPanel config={config} onConfigChange={setConfig} busy={busy} onSave={() => void saveMarketConfig()} />
        ) : tab === 'audit' ? (
          <AuditPanel auditEvents={auditEvents} />
        ) : (
          <TrustTransportAdminAccounts />
        )}
      </div>
    </div>
  );
}
