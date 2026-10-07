// Opened from the "+ Add your goal" chip: one goal with a finish line, and its cards one per line.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PPButton, PPTextBox } from './PPButton';
import { usePPTheme } from './usePPTheme';

export function NewGoalForm({ busy, onPost, onCancel }: {
  busy: boolean;
  onPost: (_title: string, _tasks: string[]) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { tokens } = usePPTheme();
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState('');
  const submit = async () => {
    const list = tasks.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    if (await onPost(title, list)) {
      setTitle('');
      setTasks('');
    }
  };
  return (
    <View accessibilityLabel="New goal" style={[styles.panel, { borderColor: tokens.border, borderRadius: tokens.radius }]}>
      <PPTextBox value={title} onChange={setTitle} lines={2} maxLength={200} placeholder="One goal with a finish line, e.g. a yard jockey job in Texas" />
      <PPTextBox
        value={tasks}
        onChange={setTasks}
        lines={4}
        maxLength={9000}
        placeholder={'Cards, one per line, each doable from a phone in under half an hour.\ne.g. Find 3 yards hiring near Dallas and add their numbers'}
      />
      <View style={styles.row}>
        <PPButton label="Post goal" primary disabled={busy || title.trim().length === 0} onPress={() => void submit()} />
        <PPButton label="Cancel" disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderStyle: 'dashed', padding: 12, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
