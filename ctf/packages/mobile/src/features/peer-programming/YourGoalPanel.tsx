// The owner's own open goal, above the sections: how far along it is, a box to add a card, and
// closing it either way (reached, or taken down).
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { interFamily } from '../../components/ui';
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
  const t = usePPTheme();
  const [task, setTask] = useState('');
  const add = async () => {
    if (await onAddTask(goal.id, task)) setTask('');
  };
  return (
    <View accessibilityLabel="Your goal" style={[styles.panel, { borderColor: t.ACCENT_TAB_BORDER, backgroundColor: t.SURFACE, borderRadius: t.r(12) }]}>
      <Text style={[styles.meta, { color: t.MUTED }]}>Your goal · {doneCount(goal)} of {goal.tasks.length} cards done</Text>
      <Text style={[styles.title, { color: t.TITLE }]}>{goal.title}</Text>
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
  meta: { fontSize: 12, fontFamily: interFamily('400') },
  title: { fontSize: 15, fontFamily: interFamily('700'), lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
