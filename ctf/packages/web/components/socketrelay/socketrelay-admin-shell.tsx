'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Trash2 } from 'lucide-react';
import type { SocketRelayFulfillment, SocketRelayRequest } from 'lib/socketrelay/types';

// Admin design tokens (shared admin look). SocketRelay accent is orange.
const COLOR = '#FB923C';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

type Tab = 'requests' | 'fulfillments';

const REQUEST_STATUS_COLOR: Record<string, string> = {
  open: '#22C55E',
  claimed: '#F59E0B',
  closed: '#6B7280',
  cancelled: '#EF4444',
};

const FULFILLMENT_STATUS_COLOR: Record<string, string> = {
  active: '#22C55E',
  closed: '#6B7280',
  cancelled: '#EF4444',
};

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${color}1f`, color, border: `1px solid ${color}4d`, textTransform: 'capitalize' }}>{label}</span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 100, padding: '12px 14px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? TEXT }}>{value}</div>
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

async function adminMutate(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<{ ok: boolean; message?: string }> {
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

export function SocketRelayAdminShell({
  requests,
  requestsTotal,
  fulfillments,
}: {
  requests: SocketRelayRequest[];
  requestsTotal: number;
  fulfillments: SocketRelayFulfillment[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('requests');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openRequests = requests.filter((r) => r.status === 'open').length;
  const activeFulfillments = fulfillments.filter((f) => f.status === 'active').length;

  async function deleteRequest(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await adminMutate(`/api/socketrelay/admin/requests/${id}`, 'DELETE');
    if (res.ok) {
      setMessage('Request removed.');
      router.refresh();
    } else {
      setError(res.message ?? 'Could not remove the request.');
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Radio size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>SocketRelay Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Requests and fulfillments</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatBlock label="Requests" value={requestsTotal} accent={COLOR} />
          <StatBlock label="Open" value={openRequests} accent="#22C55E" />
          <StatBlock label="Fulfillments" value={fulfillments.length} />
          <StatBlock label="Active" value={activeFulfillments} accent="#22C55E" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['requests', 'fulfillments'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              style={{ padding: '6px 16px', borderRadius: 8, textTransform: 'capitalize', background: tab === t ? COLOR : SURFACE, border: `1px solid ${tab === t ? COLOR : BORDER}`, color: tab === t ? '#3a1d05' : SUBTLE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {t}
            </button>
          ))}
        </div>

        {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
        {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: COLOR }}>{message}</div> : null}

        {tab === 'requests' ? (
          requests.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>No requests yet.</div>
          ) : (
            requests.map((r) => (
              <div key={r.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{r.title}</span>
                  <Pill label={r.status} color={REQUEST_STATUS_COLOR[r.status] ?? SUBTLE} />
                </div>
                <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 8 }}>
                  {[r.ownerUsername ? `@${r.ownerUsername}` : r.ownerUserId, r.city, r.tags.join(', ') || null].filter(Boolean).join(' · ')}
                </div>
                <button type="button" disabled={busy} onClick={() => void deleteRequest(r.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            ))
          )
        ) : (
          fulfillments.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>No fulfillments yet.</div>
          ) : (
            fulfillments.map((f) => (
              <div key={f.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Request {f.requestId}</span>
                  <Pill label={f.status} color={FULFILLMENT_STATUS_COLOR[f.status] ?? SUBTLE} />
                </div>
                <div style={{ fontSize: 12, color: SUBTLE }}>Requester {f.requesterUserId} · Fulfiller {f.fulfillerUserId}</div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
