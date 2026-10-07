// The Goals tab: loading, error and no-cohort states, the read-only notice for an ended cohort, and
// the board itself.
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { actOnTask, addGoalTask, closeGoal, editGoalTask, postGoal } from './PeerProgrammingApi';
import { GoalsBoard } from './GoalsBoard';
import { PPButton } from './PPButton';
import { useGoalBoard } from './useGoalBoard';
import { usePPTheme } from './usePPTheme';

function Notice({ text, tone }: { text: string; tone: 'muted' | 'error' }) {
  const { tokens } = usePPTheme();
  return (
    <Text accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.notice, { color: tone === 'error' ? tokens.danger : tokens.textSecondary }]}>
      {text}
    </Text>
  );
}

export function GoalsTab({ refreshKey }: { refreshKey: number }) {
  const { accent } = usePPTheme();
  const { board, error, busy, run, refresh } = useGoalBoard(refreshKey);
  if (!board) {
    return error ? (
      <View style={styles.stack}>
        <Notice tone="error" text={error} />
        <PPButton label="Try again" onPress={() => void refresh()} />
      </View>
    ) : (
      <ActivityIndicator style={styles.spinner} color={accent} accessibilityLabel="Loading the goal board" />
    );
  }
  if (!board.cohortId) return <Notice tone="muted" text="You are not in a cohort yet, so there is no goal board to show." />;
  return (
    <View style={styles.stack}>
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
  stack: { gap: 12 },
  notice: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  spinner: { marginTop: 24 },
});
