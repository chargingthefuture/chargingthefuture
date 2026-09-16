'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import {
  TI_RADIO_MAX_DESCRIPTION_LENGTH,
  TI_RADIO_MAX_TITLE_LENGTH,
  TI_RADIO_SLOT_MINUTES,
} from 'lib/ti-radio/constants';
import { formatDayLabel, formatRange } from './ti-radio-shared';

type Props = {
  slotStartIso: string;
  slotEndIso: string;
  tz: string;
  t: PluginShellTokens;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: { title: string; description: string }) => void;
};

// What a host says before the slot is theirs. Two fields and no more: a subject, which is the line
// the guide prints, and an optional few sentences for somebody deciding whether to come.
//
// The time is shown and not editable — it was chosen by pressing that row, and a second place to
// change it is a second chance to book the wrong one.
export function TiRadioHostForm({ slotStartIso, slotEndIso, tz, t, busy, error, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const titleRef = useRef<HTMLInputElement | null>(null);

  // A member who pressed a row is ready to type, and somebody on a keyboard or a screen reader has
  // no other way to tell the form opened. Focus is moved without scrolling, because the guide is
  // already bringing this form into view and two scrolls at once land in the wrong place.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div style={{ borderRadius: 14, background: t.SURFACE, border: `1px solid ${t.ACCENT}55`, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Host this slot</div>
          <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 3 }}>
            {formatDayLabel(slotStartIso, tz)}, {formatRange(slotStartIso, slotEndIso, tz)} · {TI_RADIO_SLOT_MINUTES} minutes
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          style={{ background: 'transparent', border: 'none', color: t.SUBTLE, cursor: 'pointer', padding: 2 }}
        >
          <X size={16} />
        </button>
      </div>

      <label style={labelStyle(t)} htmlFor="ti-radio-title">
        What is it about?
      </label>
      <input
        id="ti-radio-title"
        ref={titleRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={TI_RADIO_MAX_TITLE_LENGTH}
        placeholder="Surviving the night shift"
        style={inputStyle(t)}
      />

      <label style={labelStyle(t)} htmlFor="ti-radio-description">
        Anything else, for somebody deciding whether to come (optional)
      </label>
      <textarea
        id="ti-radio-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={TI_RADIO_MAX_DESCRIPTION_LENGTH}
        rows={3}
        style={{ ...inputStyle(t), resize: 'vertical' }}
      />

      <p style={{ fontSize: 11, color: t.FAINT, margin: '10px 0 0' }}>
        Your handle and what you wrote here go on the public guide, which anyone can read without an
        account. Everyone meets in Chyme at that time.
      </p>

      {error && (
        <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: '10px 0 0' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          type="button"
          disabled={busy || title.trim().length < 3}
          onClick={() => onSubmit({ title: title.trim(), description: description.trim() })}
          style={{
            padding: '9px 16px',
            borderRadius: 10,
            background: t.ACCENT,
            border: 'none',
            color: '#0F1117',
            fontSize: 13,
            fontWeight: 700,
            cursor: busy || title.trim().length < 3 ? 'default' : 'pointer',
            opacity: busy || title.trim().length < 3 ? 0.55 : 1,
          }}
        >
          {busy ? 'Booking…' : 'Take this slot'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '9px 16px',
            borderRadius: 10,
            background: 'transparent',
            border: `1px solid ${t.BORDER_SOLID}`,
            color: t.SUBTLE,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function labelStyle(t: PluginShellTokens) {
  return {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: t.SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    margin: '14px 0 6px',
  } as const;
}

function inputStyle(t: PluginShellTokens) {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 11px',
    borderRadius: 10,
    background: t.INPUT_BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    color: t.TEXT,
    fontSize: 13,
    fontFamily: 'inherit',
  } as const;
}
