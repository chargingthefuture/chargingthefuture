'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { getWorkforceTokens, type WorkforceTokens } from './workforce-shared';
import type { WorkforceConfig, WorkforceDashboard } from 'lib/workforce/types';

// Admin chrome (shared admin look) comes from the theme tokens; Workforce accent is orange.
const fieldStyle = (t: WorkforceTokens) =>
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

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 110, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? t.TITLE }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
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
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.MUTED, marginBottom: 6 }}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? '1'}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
        style={fieldStyle(t)}
      />
      {hint ? <span style={{ display: 'block', fontSize: 11, color: t.MUTED, marginTop: 4 }}>{hint}</span> : null}
    </label>
  );
}

// Pick the most specific error text the server returned, falling back to a status-based message.
function resolveErrorMessage(
  data: { message?: string; reason?: string; code?: string } | null,
  status: number,
): string {
  return data?.message ?? data?.reason ?? data?.code ?? `Request failed (${status}).`;
}

async function adminMutate(
  url: string,
  method: 'PUT',
  body?: unknown,
): Promise<{ ok: boolean; message?: string; config?: WorkforceConfig }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { message?: string; reason?: string; code?: string; config?: WorkforceConfig }
      | null;
    if (res.ok) return { ok: true, config: data?.config };
    return { ok: false, message: resolveErrorMessage(data, res.status) };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}

type WorkforceAuditEventItem = {
  id: string;
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  createdAtIso: string;
};

type AuditEventsResponseBody =
  | { items?: WorkforceAuditEventItem[]; pagination?: { page: number; pageSize: number; total: number }; message?: string; reason?: string; code?: string }
  | null;

function parseAuditEventsPage(data: AuditEventsResponseBody, page: number): { ok: true; items: WorkforceAuditEventItem[]; hasMore: boolean } {
  const items = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageSize = data?.pagination?.pageSize ?? items.length;
  return { ok: true, items, hasMore: page * pageSize < total };
}

async function fetchAuditEventsPage(
  page: number,
): Promise<{ ok: true; items: WorkforceAuditEventItem[]; hasMore: boolean } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/workforce/admin/audit-events?page=${page}`);
    const data = (await res.json().catch(() => null)) as AuditEventsResponseBody;
    if (!res.ok) {
      return { ok: false, message: resolveErrorMessage(data, res.status) };
    }
    return parseAuditEventsPage(data, page);
  } catch (err) {
    return { ok: false, message: `Could not load the audit trail: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Read-only viewer over GET /api/workforce/admin/audit-events. Loaded on demand so the
// snapshot/config screen stays light; every fetch is itself an audited admin action server-side.
function AuditTrailPanel() {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const [events, setEvents] = useState<WorkforceAuditEventItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(nextPage: number) {
    if (loading) return;
    setLoading(true);
    setError(null);
    const outcome = await fetchAuditEventsPage(nextPage);
    if (!outcome.ok) {
      setError(outcome.message);
    } else {
      setEvents((prev) => (nextPage === 1 ? outcome.items : [...prev, ...outcome.items]));
      setPage(nextPage);
      setHasMore(outcome.hasMore);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: '16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Audit trail</div>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 14 }}>
        Every admin action on this plugin, newest first. Viewing the trail is itself recorded.
      </div>

      {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}

      {events.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {events.map((event) => (
            <div key={event.id} style={{ padding: '10px 12px', borderRadius: 8, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.TITLE }}>{event.command}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: event.policyStatus === 'allow' ? '#22C55E' : '#EF4444' }}>
                  {event.policyStatus}
                </span>
                <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>{new Date(event.createdAtIso).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11, color: t.MUTED, marginTop: 4 }}>
                {event.reason} · record {event.targetType}/{event.targetId} · actor {event.actorId}
              </div>
            </div>
          ))}
        </div>
      ) : page > 0 && !loading ? (
        <div style={{ fontSize: 13, color: t.MUTED, marginBottom: 12 }}>No audit events recorded yet.</div>
      ) : null}

      {(page === 0 || hasMore) && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadPage(page + 1)}
          style={{ padding: '9px 16px', borderRadius: 10, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Loading…' : page === 0 ? 'Load audit trail' : 'Load more'}
        </button>
      )}
    </div>
  );
}

export function WorkforceAdminShell({
  dashboard,
  config: initialConfig,
}: {
  dashboard: WorkforceDashboard;
  config: WorkforceConfig;
}) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
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
      // Adopt the server-returned config so the form shows the values the server actually stored
      // (it may clamp or normalize what was typed), not the unverified local input.
      if (res.config) {
        setConfig({
          population: res.config.population,
          participationRate: res.config.participationRate,
          minRecruitable: res.config.minRecruitable,
          maxRecruitable: res.config.maxRecruitable,
        });
      }
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
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="Workforce Admin" accent={t.ACCENT} icon={<Briefcase size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/workforce" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}
        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatBlock label="Workforce total" value={dashboard.workforceTotal} accent={t.ACCENT} />
          <StatBlock label="Headcount goal" value={dashboard.totalHeadcountTarget} accent="#EF4444" />
          <StatBlock label="Recruited" value={dashboard.recruitedTotal} accent="#22C55E" />
          <StatBlock label="Directory members" value={dashboard.totalMembers} />
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: t.ACCENT }}>{message}</div> : null}

        {/* Config — workforce population model. Read-only over Directory/Skills Taxonomy; only this
            workforce-owned config is editable. */}
        <div style={{ padding: '16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Config</div>
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 14 }}>
            Demand is population × participation rate, distributed across sectors by their Skills Taxonomy
            workforce share. Current workforce total: <span style={{ color: t.TITLE, fontWeight: 700 }}>{workforceTotal.toLocaleString()}</span>.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <NumberField label="Population" hint="Survivor population baseline" value={config.population} onChange={(v) => setConfig((c) => ({ ...c, population: v }))} />
            <NumberField label="Participation rate" hint="0–1 (e.g. 0.5)" step="0.01" value={config.participationRate} onChange={(v) => setConfig((c) => ({ ...c, participationRate: v }))} />
            <NumberField label="Min recruitable" value={config.minRecruitable} onChange={(v) => setConfig((c) => ({ ...c, minRecruitable: v }))} />
            <NumberField label="Max recruitable" value={config.maxRecruitable} onChange={(v) => setConfig((c) => ({ ...c, maxRecruitable: v }))} />
          </div>
          <button type="button" disabled={busy} onClick={() => void save()} style={{ padding: '11px 18px', borderRadius: 10, background: busy ? `${t.ACCENT}66` : t.ACCENT, border: 'none', color: '#3a1d05', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Saving…' : 'Save config'}
          </button>
        </div>

        <AuditTrailPanel />
      </div>
    </div>
  );
}
