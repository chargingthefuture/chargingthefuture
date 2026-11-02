'use client';

import { useState } from 'react';
import { CopyRow } from './copy-row';
import * as api from './api';
import type { DailyPostTemplateItem, ShellTokens, TickMap } from './types';

// The owner's own posts that are not on the blog. Each saved template becomes a copy control with
// its title, kept for reuse, and can be edited or deleted.

type Props = {
  t: ShellTokens;
  initial: DailyPostTemplateItem[];
  today: string;
  ticks: TickMap;
  onTick: (itemKey: string, done: boolean) => Promise<string | null>;
};

type Draft = { id: string | null; title: string; body: string };

export function TemplatesSection({ t, initial, today, ticks, onTick }: Props) {
  const [templates, setTemplates] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft) return;
    setBusy(true);
    const result = draft.id ? await api.updateTemplate(draft.id, draft.title, draft.body) : await api.createTemplate(draft.title, draft.body);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const saved = result.data.template;
    setTemplates((list) => (draft.id ? list.map((item) => (item.id === saved.id ? saved : item)) : [...list, saved]));
    setDraft(null);
    setMessage(null);
  }

  async function remove(item: DailyPostTemplateItem) {
    if (!window.confirm(`Delete the template "${item.title}"?`)) return;
    const result = await api.deleteTemplate(item.id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setTemplates((list) => list.filter((entry) => entry.id !== item.id));
  }

  const field = {
    width: '100%',
    boxSizing: 'border-box',
    background: t.INPUT_BG,
    color: t.TEXT,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13.5,
    fontFamily: 'inherit',
  } as const;
  const small = { background: 'none', border: 'none', color: t.MUTED, fontSize: 11.5, padding: '4px 10px 0 0', cursor: 'pointer' } as const;

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {templates.length === 0 && !draft && (
        <p style={{ fontSize: 12.5, color: t.MUTED, margin: 0 }}>No templates yet. Add a post you reuse and it gets its own Copy button.</p>
      )}
      {templates.map((item) => {
        const days = ticks[`template:${item.id}`] ?? [];
        return (
          <CopyRow
            key={item.id}
            t={t}
            label={item.title}
            text={item.body}
            doneToday={days[0] === today}
            lastDone={days[0] ?? null}
            onTick={(done) => onTick(`template:${item.id}`, done)}
          >
            <button type="button" style={small} onClick={() => setDraft({ id: item.id, title: item.title, body: item.body })}>
              Edit
            </button>
            <button type="button" style={small} onClick={() => void remove(item)}>
              Delete
            </button>
          </CopyRow>
        );
      })}
      {draft ? (
        <div style={{ display: 'grid', gap: 6, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, padding: 10 }}>
          <input style={field} placeholder="Title" value={draft.title} maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <textarea style={{ ...field, minHeight: 160, resize: 'vertical' }} placeholder="The post, exactly as it should be pasted" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy} onClick={() => void save()} style={{ background: t.ACCENT, color: '#0B0B0F', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {draft.id ? 'Save changes' : 'Save template'}
            </button>
            <button type="button" disabled={busy} onClick={() => setDraft(null)} style={{ ...field, width: 'auto', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDraft({ id: null, title: '', body: '' })}
          style={{ background: 'none', border: `1px dashed ${t.BORDER_SOLID}`, borderRadius: 10, padding: '10px', color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Add a template
        </button>
      )}
      {message && (
        <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
