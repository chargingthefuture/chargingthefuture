'use client';

// Problem curation (functional admin surface, dark admin design system — accent lime). Problems
// are the admin-owned categories that members attach suggestions to; this is where they are
// created, renamed, and deactivated.
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AdminProblem } from './ww-admin-shared';

const COLOR = '#84CC16';
const SURFACE = '#161B27';
const PANEL = '#0D0F14';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

const inputStyle: React.CSSProperties = {
  borderRadius: 8,
  background: PANEL,
  border: `1px solid ${BORDER}`,
  color: TEXT,
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
};

type CreateDraft = { emoji: string; title: string; context: string };

type Props = {
  problems: AdminProblem[];
  busyId: string | null;
  creating: boolean;
  onCreate: (draft: CreateDraft) => Promise<boolean>;
  onToggleActive: (problem: AdminProblem) => void;
  onDelete: (problem: AdminProblem) => void;
};

export function WhatWorksAdminProblems({ problems, busyId, creating, onCreate, onToggleActive, onDelete }: Props) {
  const [emoji, setEmoji] = useState('');
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');

  async function create(): Promise<void> {
    if (!title.trim() || creating) return;
    const ok = await onCreate({ emoji: emoji.trim(), title: title.trim(), context: context.trim() });
    if (ok) {
      setEmoji('');
      setTitle('');
      setContext('');
    }
  }

  return (
    <section style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: TEXT, margin: '0 0 12px' }}>Problems</h2>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 10 }}>Add a problem category survivors can attach tools to.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input value={emoji} onChange={(event) => setEmoji(event.target.value)} placeholder="Emoji" aria-label="Emoji" style={{ ...inputStyle, width: 80, flexShrink: 0 }} />
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Problem title (e.g. Sleep Disruption)" aria-label="Problem title" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        </div>
        <textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="Short context shown under the title" aria-label="Problem context" rows={2} style={{ ...inputStyle, width: '100%', marginTop: 8, resize: 'vertical', boxSizing: 'border-box' }} />
        <div style={{ marginTop: 10 }}>
          <button type="button" disabled={!title.trim() || creating} onClick={() => void create()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: !title.trim() || creating ? 'not-allowed' : 'pointer', opacity: !title.trim() || creating ? 0.6 : 1 }}>
            <Plus size={13} /> {creating ? 'Adding…' : 'Add problem'}
          </button>
        </div>
      </div>

      {problems.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
          No problems yet. Add the first one above.
        </div>
      ) : (
        problems.map((problem) => {
          const busy = busyId === problem.id;
          return (
            <div key={problem.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span aria-hidden>{problem.emoji || '🧰'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{problem.title}</span>
                  {!problem.is_active ? (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: '1px solid rgba(107,114,128,0.3)' }}>inactive</span>
                  ) : null}
                </div>
                {problem.context ? <div style={{ fontSize: 12, color: SUBTLE, marginTop: 4 }}>{problem.context}</div> : null}
                <div style={{ fontSize: 11, color: SUBTLE, marginTop: 4 }}>
                  {problem.approvedCount} approved · {problem.pendingCount} pending · {problem.productCount} total
                </div>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, flexDirection: 'column', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => onToggleActive(problem)} style={{ padding: '7px 12px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {problem.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" disabled={busy} onClick={() => onDelete(problem)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
