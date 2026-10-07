// One card on the goal board: whose goal it is, the card's words, who is on it or did it, the
// posted result, and the controls the viewer has for it.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TaskAction } from './PeerProgrammingApi';
import { goalColor, nameOf, statusLine, type Card } from './ppBoard';
import { GoalCardControls } from './GoalCardControls';
import { usePPTheme } from './usePPTheme';

export type BoardProps = {
  viewerUserId: string;
  names: Record<string, string>;
  readOnly: boolean;
  busy: boolean;
  taskHoldHours: number;
  onAction: (_taskId: string, _action: TaskAction, _result?: string) => void;
  onEditTask: (_taskId: string, _description: string) => Promise<boolean>;
};

export function GoalCard({ card, ...props }: BoardProps & { card: Card }) {
  const { tokens, accent } = usePPTheme();
  const { task, goal } = card;
  const isOwner = goal.ownerUserId === props.viewerUserId;
  const owner = isOwner ? 'Your goal' : nameOf(goal.ownerUserId, props.names);
  const status = statusLine(card, props.viewerUserId, props.names);
  const canAct = !props.readOnly && goal.status === 'open';
  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderLeftColor: goalColor(goal.id), borderRadius: tokens.radius }]}>
      <Text numberOfLines={1} style={[styles.owner, { color: tokens.textMuted }]}>{owner} · {goal.title}</Text>
      <Text style={[styles.description, { color: tokens.textPrimary }]}>{task.description}</Text>
      {status ? <Text style={[styles.status, { color: tokens.textSecondary }]}>{status}</Text> : null}
      {task.result ? (
        <Text style={[styles.result, { color: tokens.textPrimary, backgroundColor: `${accent}1F` }]}>{task.result}</Text>
      ) : null}
      {canAct ? <GoalCardControls task={task} isOwner={isOwner} {...props} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 10, borderLeftWidth: 4, gap: 6 },
  owner: { fontSize: 11 },
  description: { fontSize: 15, lineHeight: 21 },
  status: { fontSize: 12 },
  result: { fontSize: 13, padding: 8, borderRadius: 8 },
});
