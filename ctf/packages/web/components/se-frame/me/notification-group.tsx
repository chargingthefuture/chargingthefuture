'use client';

import { useState } from 'react';
import {
  SE_DEFAULT_QUIET,
  SE_NOTIFY_GROUP_LABELS,
  SE_NOTIFY_GROUPS,
  SE_SETTINGS_WORDS as W,
  seClockValue,
  seParseClock,
  type SeQuietHours,
} from '@ctf/shared';
import { SettingsGroup, SettingsRow } from './settings-rows';
import { useNotifyPrefs } from './use-notify-prefs';
import styles from './settings.module.css';

// Settings → Notifications: "Replies and talk requests", "Rooms starting", "Everything else", each
// On or Off, and Quiet hours, which open in place to choose the hours or turn them off.

function QuietEditor({ quiet, onSave, onDone }: { quiet: SeQuietHours | null; onSave: (_quiet: SeQuietHours | null) => void; onDone: () => void }) {
  const [from, setFrom] = useState(seClockValue(quiet?.startMinute ?? SE_DEFAULT_QUIET.startMinute));
  const [to, setTo] = useState(seClockValue(quiet?.endMinute ?? SE_DEFAULT_QUIET.endMinute));
  const start = seParseClock(from);
  const end = seParseClock(to);
  const save = () => {
    if (start === null || end === null) return;
    onSave({ startMinute: start, endMinute: end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    onDone();
  };
  return (
    <div className={styles.panel}>
      <div className={styles.fields}>
        <label className={styles.field}>
          {W.quietFrom}
          <input type="time" className={styles.time} value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className={styles.field}>
          {W.quietTo}
          <input type="time" className={styles.time} value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      <div className={styles.buttons}>
        <button type="button" className={`${styles.pill} ${styles.primary}`} disabled={start === null || end === null} onClick={save}>
          {W.quietSave}
        </button>
        {quiet ? (
          <button
            type="button"
            className={styles.pill}
            onClick={() => {
              onSave(null);
              onDone();
            }}
          >
            {W.quietOff}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationGroup() {
  const { state, note, toggle, setQuiet } = useNotifyPrefs();
  const [editing, setEditing] = useState(false);
  const quiet = state?.quiet ?? null;
  return (
    <SettingsGroup
      title={W.notifications}
      after={
        note ? (
          <p role="alert" className={styles.alert}>
            {note}
          </p>
        ) : null
      }
    >
      {SE_NOTIFY_GROUPS.map((group) => (
        <SettingsRow
          key={group}
          label={SE_NOTIFY_GROUP_LABELS[group]}
          value={state ? (state[group] ? W.on : W.off) : '…'}
          pressed={state?.[group] ?? false}
          onPress={() => toggle(group)}
        />
      ))}
      <SettingsRow
        label={W.quietHours}
        value={quiet ? W.quietRange(quiet.startMinute, quiet.endMinute) : W.off}
        expanded={editing}
        onPress={() => setEditing((value) => !value)}
      />
      {editing && state ? <QuietEditor quiet={quiet} onSave={setQuiet} onDone={() => setEditing(false)} /> : null}
    </SettingsGroup>
  );
}
