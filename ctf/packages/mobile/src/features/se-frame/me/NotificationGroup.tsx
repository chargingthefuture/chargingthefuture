// Settings → Notifications on Android, the copy of the web's notification-group.tsx: the three rows,
// each On or Off, and Quiet hours, which open in place to choose the hours (the phone's time picker)
// or turn them off.

import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  SE_DEFAULT_QUIET,
  SE_NOTIFY_GROUP_LABELS,
  SE_NOTIFY_GROUPS,
  SE_SETTINGS_WORDS as W,
  seClockLabel,
  type SeQuietHours,
  type SeThemeTokens,
} from '@ctf/shared';
import type { MeStyles } from './meStyles';
import { useNotifyPrefs } from './meData';
import { SettingsGroup, SettingsRow } from './SettingsParts';

function pickTime(minute: number, onPick: (_minute: number) => void) {
  const value = new Date();
  value.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  DateTimePickerAndroid.open({
    value,
    mode: 'time',
    onChange: (event, picked) => {
      if (event.type === 'set' && picked) onPick(picked.getHours() * 60 + picked.getMinutes());
    },
  });
}

function QuietEditor({ s, quiet, onSave, onDone }: { s: MeStyles; quiet: SeQuietHours | null; onSave: (_q: SeQuietHours | null) => void; onDone: () => void }) {
  const [start, setStart] = useState(quiet?.startMinute ?? SE_DEFAULT_QUIET.startMinute);
  const [end, setEnd] = useState(quiet?.endMinute ?? SE_DEFAULT_QUIET.endMinute);
  const save = () => {
    onSave({ startMinute: start, endMinute: end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    onDone();
  };
  const times: Array<[string, number, (_m: number) => void]> = [
    [W.quietFrom, start, setStart],
    [W.quietTo, end, setEnd],
  ];
  return (
    <View style={s.panel}>
      <View style={s.row}>
        {times.map(([label, minute, set]) => (
          <View key={label} style={s.field}>
            <Text style={s.q}>{label}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} ${seClockLabel(minute)}`} onPress={() => pickTime(minute, set)} style={s.pill}>
              <Text style={s.pillLabel}>{seClockLabel(minute)}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      <View style={s.row}>
        <TouchableOpacity accessibilityRole="button" onPress={save} style={[s.pill, s.primary]}>
          <Text style={[s.pillLabel, s.primaryLabel]}>{W.quietSave}</Text>
        </TouchableOpacity>
        {quiet ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              onSave(null);
              onDone();
            }}
            style={s.pill}
          >
            <Text style={s.pillLabel}>{W.quietOff}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function NotificationGroup({ s, t }: { s: MeStyles; t: SeThemeTokens }) {
  const { state, note, toggle, setQuiet } = useNotifyPrefs();
  const [editing, setEditing] = useState(false);
  const quiet = state?.quiet ?? null;
  return (
    <SettingsGroup
      s={s}
      title={W.notifications}
      after={
        note ? (
          <Text accessibilityRole="alert" style={s.alert}>
            {note}
          </Text>
        ) : null
      }
    >
      {SE_NOTIFY_GROUPS.map((group) => (
        <SettingsRow
          key={group}
          s={s}
          t={t}
          label={SE_NOTIFY_GROUP_LABELS[group]}
          value={state ? (state[group] ? W.on : W.off) : '…'}
          pressed={state?.[group] ?? false}
          onPress={() => toggle(group)}
        />
      ))}
      <SettingsRow
        s={s}
        t={t}
        label={W.quietHours}
        value={quiet ? W.quietRange(quiet.startMinute, quiet.endMinute) : W.off}
        expanded={editing}
        onPress={() => setEditing((value) => !value)}
        last={!editing}
      />
      {editing && state ? <QuietEditor s={s} quiet={quiet} onSave={setQuiet} onDone={() => setEditing(false)} /> : null}
    </SettingsGroup>
  );
}
