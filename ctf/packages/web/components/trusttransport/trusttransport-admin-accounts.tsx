'use client';

import { useState } from 'react';
import { ShieldOff, ShieldCheck } from 'lucide-react';

// Admin design tokens (shared admin look). TrustTransport accent is sky blue.
const COLOR = '#38BDF8';
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

async function adminMutate(url: string, body?: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
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

export function TrustTransportAdminAccounts() {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<null | 'restrict' | 'restore'>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(kind: 'restrict' | 'restore') {
    if (busy) return;
    const id = userId.trim();
    if (!id) {
      setError('Enter the user ID to act on.');
      return;
    }
    setBusy(kind);
    setError(null);
    setMessage(null);
    const res = kind === 'restrict'
      ? await adminMutate(`/api/trusttransport/admin/accounts/${encodeURIComponent(id)}/restrict`, { reason: reason.trim() || null })
      : await adminMutate(`/api/trusttransport/admin/accounts/${encodeURIComponent(id)}/restore`, {});
    if (res.ok) {
      setMessage(kind === 'restrict' ? `Account ${id} restricted.` : `Account ${id} restored.`);
    } else {
      setError(res.message ?? 'Action failed.');
    }
    setBusy(null);
  }

  return (
    <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Account actions</div>
      <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 14 }}>
        Restrict pauses a member from TrustTransport (e.g. after an incident); restore lifts it. Enter the member&rsquo;s user ID (copy it from the incident you&rsquo;re reviewing).
      </div>
      <label style={{ display: 'block', marginBottom: 10 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>User ID</span>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user_…" style={fieldStyle} />
      </label>
      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUBTLE, marginBottom: 6 }}>Reason (for restrict)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this account being restricted?" style={fieldStyle} />
      </label>

      {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
      {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: COLOR }}>{message}</div> : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy !== null} onClick={() => void act('restrict')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
          <ShieldOff size={14} /> {busy === 'restrict' ? 'Restricting…' : 'Restrict account'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void act('restore')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
          <ShieldCheck size={14} /> {busy === 'restore' ? 'Restoring…' : 'Restore account'}
        </button>
      </div>
    </div>
  );
}
