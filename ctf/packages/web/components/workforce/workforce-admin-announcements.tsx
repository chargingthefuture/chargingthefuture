'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { WorkforceAnnouncement } from 'lib/workforce/types';

// Admin design tokens (shared admin look). Workforce accent is orange.
const COLOR = '#F97316';
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

export function WorkforceAdminAnnouncements({ announcements }: { announcements: WorkforceAnnouncement[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState({ title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    if (busy) return;
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await adminMutate('/api/workforce/admin/announcements', 'POST', { title: draft.title.trim(), body: draft.body.trim(), isActive: true, expiresAtIso: null });
    if (res.ok) {
      setMessage('Announcement posted.');
      setDraft({ title: '', body: '' });
      router.refresh();
    } else {
      setError(res.message ?? 'Could not post the announcement.');
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await adminMutate(`/api/workforce/admin/announcements/${id}`, 'DELETE');
    if (res.ok) {
      setMessage('Announcement deleted.');
      router.refresh();
    } else {
      setError(res.message ?? 'Could not delete the announcement.');
    }
    setBusy(false);
  }

  return (
    <>
      {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
      {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: COLOR }}>{message}</div> : null}

      <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Post an announcement</div>
        <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Title" style={{ ...fieldStyle, marginBottom: 10 }} />
        <textarea value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} placeholder="Message" rows={3} style={{ ...fieldStyle, resize: 'none', marginBottom: 12 }} />
        <button type="button" disabled={busy} onClick={() => void create()} style={{ padding: '10px 16px', borderRadius: 10, background: busy ? `${COLOR}66` : COLOR, border: 'none', color: '#3a1d05', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy ? 'Working…' : 'Post announcement'}
        </button>
      </div>

      {announcements.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>No announcements yet.</div>
      ) : (
        announcements.map((a) => (
          <div key={a.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{a.title}</span>
              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: a.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.14)', color: a.isActive ? '#22C55E' : '#9CA3AF', border: `1px solid ${a.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}` }}>{a.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 8 }}>{a.body}</div>
            <button type="button" disabled={busy} onClick={() => void remove(a.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        ))
      )}
    </>
  );
}
