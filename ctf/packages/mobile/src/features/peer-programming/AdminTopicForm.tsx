// The weekly topic editor, copied from the web's PeerProgrammingAdminTopicForm (web components/
// peer-programming/pp-admin-topic-form.tsx). The week start date is typed as YYYY-MM-DD: the web
// uses the browser's date box, and the app has no date picker installed.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { interFamily } from '../../components/ui';
import type { AdminTopic, TopicDraft } from './PeerProgrammingAdminApi';
import { AdminInput, FieldLabel, SolidButton, TickBox } from './AdminParts';
import { usePPTheme } from './usePPTheme';

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
        <AdminInput value={draft.weekStartDate} onChangeText={(weekStartDate) => update({ weekStartDate })} placeholder="YYYY-MM-DD" autoCapitalize="none" />
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
  hint: { fontSize: 11, lineHeight: 16.5, marginTop: 6, fontFamily: interFamily('400') },
});
