'use client';

// Problem curation (functional admin surface, dark admin design system — accent lime). Problems
// are the admin-owned categories that members attach suggestions to; this is where they are
// created, renamed, and deactivated.
import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { AdminProblem } from './ww-admin-shared';
import { getWhatWorksTokens, type WhatWorksTokens } from './ww-shared';

const makeInputStyle = (t: WhatWorksTokens): React.CSSProperties => ({
  borderRadius: 8,
  background: t.HEADER,
  border: `1px solid ${t.BORDER_SOLID}`,
  color: t.TITLE,
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
});

type CreateDraft = { emoji: string; title: string; context: string };

type Props = {
  problems: AdminProblem[];
  busyId: string | null;
  creating: boolean;
  onCreate: (draft: CreateDraft) => Promise<boolean>;
  onEdit: (problem: AdminProblem, patch: CreateDraft) => Promise<boolean>;
  onToggleActive: (problem: AdminProblem) => void;
  onDelete: (problem: AdminProblem) => void;
};

export function WhatWorksAdminProblems({ problems, busyId, creating, onCreate, onEdit, onToggleActive, onDelete }: Props) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  const inputStyle = makeInputStyle(t);
  const [emoji, setEmoji] = useState('');
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');

  // Inline edit of an existing problem. editingId marks which card is in edit mode; the draft fields
  // are seeded from the problem and saved through the same PATCH the deactivate toggle already uses.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmoji, setEditEmoji] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContext, setEditContext] = useState('');

  // Inline two-step delete confirmation (replaces window.confirm).
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  async function create(): Promise<void> {
    if (!title.trim() || creating) return;
    const ok = await onCreate({ emoji: emoji.trim(), title: title.trim(), context: context.trim() });
    if (ok) {
      setEmoji('');
      setTitle('');
      setContext('');
    }
  }

  function startEdit(problem: AdminProblem): void {
    setEditingId(problem.id);
    setEditEmoji(problem.emoji ?? '');
    setEditTitle(problem.title);
    setEditContext(problem.context ?? '');
  }

  async function saveEdit(problem: AdminProblem): Promise<void> {
    if (!editTitle.trim()) return;
    const ok = await onEdit(problem, { emoji: editEmoji.trim(), title: editTitle.trim(), context: editContext.trim() });
    if (ok) setEditingId(null);
  }

  return (
    <section style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: t.TITLE, margin: '0 0 12px' }}>Problems</h2>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 10 }}>Add a problem category survivors can attach tools to.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input value={emoji} onChange={(event) => setEmoji(event.target.value)} placeholder="Emoji" aria-label="Emoji" style={{ ...inputStyle, width: 80, flexShrink: 0 }} />
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Problem title (e.g. Sleep Disruption)" aria-label="Problem title" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        </div>
        <textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="Short context shown under the title" aria-label="Problem context" rows={2} style={{ ...inputStyle, width: '100%', marginTop: 8, resize: 'vertical', boxSizing: 'border-box' }} />
        <div style={{ marginTop: 10 }}>
          <button type="button" disabled={!title.trim() || creating} onClick={() => void create()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: !title.trim() || creating ? 'not-allowed' : 'pointer', opacity: !title.trim() || creating ? 0.6 : 1 }}>
            <Plus size={13} /> {creating ? 'Adding…' : 'Add problem'}
          </button>
        </div>
      </div>

      {problems.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          No problems yet. Add the first one above.
        </div>
      ) : (
        problems.map((problem) => {
          const busy = busyId === problem.id;
          if (editingId === problem.id) {
            const canSave = Boolean(editTitle.trim()) && !busy;
            return (
              <div key={problem.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.ACCENT}40` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <input value={editEmoji} onChange={(event) => setEditEmoji(event.target.value)} placeholder="Emoji" aria-label="Edit emoji" style={{ ...inputStyle, width: 80, flexShrink: 0 }} />
                  <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Problem title" aria-label="Edit problem title" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
                </div>
                <textarea value={editContext} onChange={(event) => setEditContext(event.target.value)} placeholder="Short context shown under the title" aria-label="Edit problem context" rows={2} style={{ ...inputStyle, width: '100%', marginTop: 8, resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" disabled={!canSave} onClick={() => void saveEdit(problem)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.6 }}>
                    <Check size={13} /> {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setEditingId(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <X size={13} /> Cancel
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div key={problem.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span aria-hidden>{problem.emoji || '🧰'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{problem.title}</span>
                  {!problem.is_active ? (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(107,114,128,0.14)', color: t.SUBTLE, border: '1px solid rgba(107,114,128,0.3)' }}>inactive</span>
                  ) : null}
                </div>
                {problem.context ? <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4 }}>{problem.context}</div> : null}
                <div style={{ fontSize: 11, color: t.MUTED, marginTop: 4 }}>
                  {problem.approvedCount} approved · {problem.pendingCount} pending · {problem.productCount} total
                </div>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, flexDirection: 'column', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => startEdit(problem)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  <Pencil size={13} /> Edit
                </button>
                <button type="button" disabled={busy} onClick={() => onToggleActive(problem)} style={{ padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {problem.is_active ? 'Deactivate' : 'Activate'}
                </button>
                {confirmingDeleteId === problem.id ? (
                  <>
                    <div style={{ fontSize: 11, color: t.MUTED, textAlign: 'right' }}>
                      Delete “{problem.title}” and its {problem.productCount} tool(s)? This cannot be undone.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" disabled={busy} onClick={() => { setConfirmingDeleteId(null); onDelete(problem); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                        <Trash2 size={13} /> Confirm
                      </button>
                      <button type="button" onClick={() => setConfirmingDeleteId(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" disabled={busy} onClick={() => setConfirmingDeleteId(problem.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
