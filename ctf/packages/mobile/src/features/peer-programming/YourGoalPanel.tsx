// The owner's own open goal, above the sections: how far along it is, a box to add a card, and
// closing it either way (reached, or taken down).
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BoardGoal } from './PeerProgrammingApi';
import { doneCount } from './ppBoard';
import { PPButton, PPTextBox } from './PPButton';
import { usePPTheme } from './usePPTheme';

export function YourGoalPanel({ goal, busy, onAddTask, onClose }: {
  goal: BoardGoal;
  busy: boolean;
  onAddTask: (_goalId: string, _description: string) => Promise<boolean>;
  onClose: (_goalId: string, _outcome: 'reached' | 'withdrawn') => void;
}) {
  const { tokens, accent } = usePPTheme();
  const [task, setTask] = useState('');
  const add = async () => {
    if (await onAddTask(goal.id, task)) setTask('');
  };
  return (
    <View accessibilityLabel="Your goal" style={[styles.panel, { borderColor: accent, backgroundColor: tokens.surface, borderRadius: tokens.radius }]}>
      <Text style={[styles.meta, { color: tokens.textMuted }]}>Your goal · {doneCount(goal)} of {goal.tasks.length} cards done</Text>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>{goal.title}</Text>
      <PPTextBox value={task} onChange={setTask} lines={2} maxLength={300} placeholder="Another card somebody could do from a phone" />
      <View style={styles.row}>
        <PPButton label="Add card" disabled={busy || task.trim().length === 0} onPress={() => void add()} />
        <PPButton label="Reached it" primary disabled={busy} onPress={() => onClose(goal.id, 'reached')} />
        <PPButton label="Take it down" disabled={busy} onPress={() => onClose(goal.id, 'withdrawn')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, padding: 12, gap: 8 },
  meta: { fontSize: 12 },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
