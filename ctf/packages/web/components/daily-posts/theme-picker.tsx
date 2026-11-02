'use client';

import { useState } from 'react';
import { DAILY_POST_THEMES, type DailyPostThemeId } from 'lib/daily-posts/themes';
import { ExcludeButton } from './exclude-button';
import type { DailyPostItem, ShellTokens } from './types';

// Choose the groups one post appears in. More than one can be ticked. "Use the post's links" drops
// the choice so the post goes back to the groups its own app links put it in.

type Props = {
  t: ShellTokens;
  post: DailyPostItem;
  onSave: (themes: DailyPostThemeId[] | null) => Promise<string | null>;
  /** Absent for a post in Unsorted, where the picker stays open until the post is placed. */
  onClose?: () => void;
  /** Leave the post out of the rotation, its groups and Today's stories. */
  onExclude?: () => Promise<string | null>;
};

export function ThemePicker({ t, post, onSave, onClose, onExclude }: Props) {
  const [picked, setPicked] = useState<Set<DailyPostThemeId>>(new Set(post.themes));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(themes: DailyPostThemeId[] | null) {
    setBusy(true);
    const failure = await onSave(themes);
    setBusy(false);
    if (failure) setMessage(failure);
    else onClose?.();
  }

  function toggle(id: DailyPostThemeId) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  const buttonStyle = {
    background: t.INPUT_BG,
    color: t.TEXT,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12.5,
    cursor: 'pointer',
  } as const;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 6 }}>{post.title}</div>
      {DAILY_POST_THEMES.map((theme) => (
        <label key={theme.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.TEXT, padding: '3px 0' }}>
          <input type="checkbox" checked={picked.has(theme.id)} onChange={() => toggle(theme.id)} />
          {theme.label}
          {post.linkThemes.includes(theme.id) && <span style={{ fontSize: 11, color: t.MUTED }}>(from its links)</span>}
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" disabled={busy} style={{ ...buttonStyle, background: t.ACCENT, color: '#0B0B0F', border: 'none', fontWeight: 700 }} onClick={() => void save([...picked])}>
          Save
        </button>
        {post.chosen && (
          <button type="button" disabled={busy} style={buttonStyle} onClick={() => void save(null)}>
            Use the post&apos;s links
          </button>
        )}
        {onClose && (
          <button type="button" disabled={busy} style={buttonStyle} onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
      {onExclude && <ExcludeButton t={t} label="Leave out of rotation (it stays on the blog)" onPress={onExclude} />}
      {message && (
        <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: '6px 0 0' }}>
          {message}
        </p>
      )}
    </div>
  );
}
