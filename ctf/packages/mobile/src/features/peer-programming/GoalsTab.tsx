// The Goals tab, copied from the web's PeerProgrammingGoalsTab (web components/peer-programming/
// pp-goals-tab.tsx): a loading line, the error, the no-cohort line, the read-only line for an ended
// cohort, and the board itself.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { interFamily } from '../../components/ui';
import { actOnTask, addGoalTask, closeGoal, editGoalTask, postGoal } from './PeerProgrammingApi';
import { GoalsBoard } from './GoalsBoard';
import { useGoalBoard } from './useGoalBoard';
import { usePPTheme } from './usePPTheme';

function Notice({ text, tone }: { text: string; tone: 'muted' | 'error' }) {
  const t = usePPTheme();
  return (
    <Text accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.notice, { color: tone === 'error' ? '#EF4444' : t.MUTED }]}>
      {text}
    </Text>
  );
}

export function GoalsTab() {
  const { board, error, busy, run } = useGoalBoard();
  if (!board) {
    return (
      <View style={styles.pad}>
        {error ? <Notice tone="error" text={error} /> : <Notice tone="muted" text="Loading the goal board…" />}
      </View>
    );
  }
  if (!board.cohortId) {
    return (
      <View style={styles.pad}>
        <Notice tone="muted" text="You are not in a cohort yet, so there is no goal board to show." />
      </View>
    );
  }
  return (
    <View style={[styles.pad, styles.stack]}>
      {error ? <Notice tone="error" text={error} /> : null}
      {board.ended ? <Notice tone="muted" text="This cohort has ended, so its board is read-only." /> : null}
      <GoalsBoard
        board={board}
        busy={busy}
        onAction={(taskId, action, result) => void run(() => actOnTask(taskId, action, result))}
        onEditTask={(taskId, description) => run(() => editGoalTask(taskId, description))}
        onAddTask={(goalId, description) => run(() => addGoalTask(goalId, description))}
        onClose={(goalId, outcome) => void run(() => closeGoal(goalId, outcome))}
        onPost={(title, tasks) => run(() => postGoal(title, tasks))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  stack: { gap: 12 },
  notice: { fontSize: 13, textAlign: 'center', paddingVertical: 8, fontFamily: interFamily('400') },
});
