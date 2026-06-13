'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, EyeOff, Eye } from 'lucide-react';
import type { WorkforceOccupation } from 'lib/workforce/types';

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

async function adminMutate(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<{ ok: boolean; message?: string }> {
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

export function WorkforceAdminOccupations({ occupations }: { occupations: WorkforceOccupation[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState({ name: '', sector: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    if (creating) return;
    if (!draft.name.trim()) {
      setError('Occupation name is required.');
      return;
    }
    setCreating(true);
    setError(null);
    setMessage(null);
    const res = await adminMutate('/api/workforce/admin/occupations', 'POST', { name: draft.name.trim(), sector: draft.sector.trim() || null, isActive: true });
    if (res.ok) {
      setMessage('Occupation added.');
      setDraft({ name: '', sector: '' });
      router.refresh();
    } else {
      setError(res.message ?? 'Could not add the occupation.');
    }
    setCreating(false);
  }

  async function run(o: WorkforceOccupation, action: 'toggle' | 'delete') {
    if (busyId) return;
    setBusyId(o.id);
    setError(null);
    setMessage(null);
    const res = action === 'delete'
      ? await adminMutate(`/api/workforce/admin/occupations/${o.id}`, 'DELETE')
      : await adminMutate(`/api/workforce/admin/occupations/${o.id}`, 'PUT', { name: o.name, sector: o.sector, isActive: !o.isActive });
    if (res.ok) {
      setMessage(action === 'delete' ? 'Occupation deleted.' : o.isActive ? 'Occupation hidden.' : 'Occupation shown.');
      router.refresh();
    } else {
      setError(res.message ?? 'Action failed.');
    }
    setBusyId(null);
  }

  return (
    <>
      {error ? <div role="alert" style={{ marginBottom: 12, fontSize: 13, color: '#EF4444' }}>{error}</div> : null}
      {message ? <div role="status" style={{ marginBottom: 12, fontSize: 13, color: COLOR }}>{message}</div> : null}

      <div style={{ padding: '16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add an occupation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name" style={fieldStyle} />
          <input value={draft.sector} onChange={(e) => setDraft((d) => ({ ...d, sector: e.target.value }))} placeholder="Sector (optional)" style={fieldStyle} />
        </div>
        <button type="button" disabled={creating} onClick={() => void create()} style={{ padding: '10px 16px', borderRadius: 10, background: creating ? `${COLOR}66` : COLOR, border: 'none', color: '#3a1d05', fontSize: 14, fontWeight: 800, cursor: creating ? 'not-allowed' : 'pointer' }}>
          {creating ? 'Adding…' : 'Add occupation'}
        </button>
      </div>

      {occupations.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>No occupations yet.</div>
      ) : (
        occupations.map((o) => (
          <div key={o.id} style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{o.name}{o.sector ? <span style={{ color: SUBTLE, fontWeight: 400 }}> · {o.sector}</span> : null}</span>
              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: o.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.14)', color: o.isActive ? '#22C55E' : '#9CA3AF', border: `1px solid ${o.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}` }}>{o.isActive ? 'Active' : 'Hidden'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={busyId === o.id} onClick={() => void run(o, 'toggle')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, cursor: busyId === o.id ? 'not-allowed' : 'pointer', opacity: busyId === o.id ? 0.6 : 1 }}>
                {o.isActive ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}
              </button>
              <button type="button" disabled={busyId === o.id} onClick={() => void run(o, 'delete')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busyId === o.id ? 'not-allowed' : 'pointer', opacity: busyId === o.id ? 0.6 : 1 }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
