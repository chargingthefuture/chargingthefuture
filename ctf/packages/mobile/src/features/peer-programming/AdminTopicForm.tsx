// The weekly topic editor, copied from the web's PeerProgrammingAdminTopicForm (web components/
// peer-programming/pp-admin-topic-form.tsx). The week start date opens Android's date picker, as the
// web's date box opens the browser's.
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { interFamily } from '../../components/ui';
import type { AdminTopic, TopicDraft } from './PeerProgrammingAdminApi';
import { AdminInput, FieldLabel, SolidButton, TickBox } from './AdminParts';
import { usePPTheme } from './usePPTheme';

// YYYY-MM-DD (the value the route takes) to and from a date at midnight UTC.
function parseDay(value: string): Date {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

// The web date box shows the date in the phone's own format; so does this field.
function showDay(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
}

// The web's date input: a box like the other fields that opens the date picker.
function DateField({ value, onChange }: { value: string; onChange: (_value: string) => void }) {
  const t = usePPTheme();
  const open = () =>
    DateTimePickerAndroid.open({
      value: parseDay(value),
      mode: 'date',
      timeZoneName: 'UTC',
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(date.toISOString().slice(0, 10));
      },
    });
  return (
    <TouchableOpacity
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Week start date"
      style={[styles.date, { backgroundColor: t.BG, borderColor: t.BORDER_SOLID, borderRadius: t.r(8) }]}
    >
      <Text style={[styles.dateText, { color: t.TITLE }]}>{showDay(value)}</Text>
    </TouchableOpacity>
  );
}

function draftFromTopic(topic: AdminTopic | null, defaultWeekStart: string): TopicDraft {
  return {
    weekStartDate: topic?.weekStartDate ?? defaultWeekStart,
    title: topic?.title ?? '',
    guidance: topic?.guidance ?? '',
    revisionNote: topic?.revisionNote ?? '',
    publish: topic?.status === 'published',
  };
}

export function AdminTopicForm({ topic, defaultWeekStart, busy, onSubmit }: {
  topic: AdminTopic | null;
  defaultWeekStart: string;
  busy: boolean;
  onSubmit: (_draft: TopicDraft) => Promise<void>;
}) {
  const t = usePPTheme();
  const [draft, setDraft] = useState<TopicDraft>(() => draftFromTopic(topic, defaultWeekStart));
  const update = (patch: Partial<TopicDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const canSubmit = draft.weekStartDate.trim().length > 0 && draft.title.trim().length > 0 && draft.guidance.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSubmit) return;
    void onSubmit({
      ...draft,
      weekStartDate: draft.weekStartDate.trim(),
      title: draft.title.trim(),
      guidance: draft.guidance.trim(),
      revisionNote: draft.revisionNote.trim(),
    });
  };

  return (
    <View style={styles.form}>
      <View>
        <FieldLabel text="Week start date" />
        <DateField value={draft.weekStartDate} onChange={(weekStartDate) => update({ weekStartDate })} />
        <Text style={[styles.hint, { color: t.MUTED }]}>Use the Monday of the target week. The room shows the topic for the current week only.</Text>
      </View>
      <View>
        <FieldLabel text="Title" />
        <AdminInput value={draft.title} onChangeText={(title) => update({ title })} placeholder="This week's focus" />
      </View>
      <View>
        <FieldLabel text="Guidance" />
        <AdminInput
          value={draft.guidance}
          onChangeText={(guidance) => update({ guidance })}
          placeholder="What should cohorts work on together this week?"
          multiline
          minHeight={112}
        />
      </View>
      <View>
        <FieldLabel text="Revision note (optional)" />
        <AdminInput value={draft.revisionNote} onChangeText={(revisionNote) => update({ revisionNote })} placeholder="Why this guidance changed" />
      </View>
      <TickBox
        checked={draft.publish}
        onChange={(publish) => update({ publish })}
        label="Publish (visible to cohorts). Leave unchecked to save as a draft."
      />
      <SolidButton
        label={busy ? 'Saving…' : draft.publish ? 'Save and publish' : 'Save draft'}
        disabled={!canSubmit}
        dim={!canSubmit}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  date: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10 },
  dateText: { fontSize: 13, fontFamily: interFamily('400') },
  hint: { fontSize: 11, lineHeight: 16.5, marginTop: 6, fontFamily: interFamily('400') },
});
