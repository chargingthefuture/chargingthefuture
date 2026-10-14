// One card on the goal board: whose goal it is, the card's words, who is on it or did it, the
// posted result, and the controls the viewer has for it.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { interFamily } from '../../components/ui';
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
  const t = usePPTheme();
  const { task, goal } = card;
  const isOwner = goal.ownerUserId === props.viewerUserId;
  const owner = isOwner ? 'Your goal' : nameOf(goal.ownerUserId, props.names);
  const status = statusLine(card, props.viewerUserId, props.names);
  const canAct = !props.readOnly && goal.status === 'open';
  return (
    <View style={[styles.card, { backgroundColor: t.SURFACE, borderLeftColor: goalColor(goal.id), borderRadius: t.r(10) }]}>
      <Text numberOfLines={1} style={[styles.owner, { color: t.MUTED }]}>{owner} · {goal.title}</Text>
      <Text style={[styles.description, { color: t.TEXT }]}>{task.description}</Text>
      {status ? <Text style={[styles.status, { color: t.SUBTLE }]}>{status}</Text> : null}
      {task.result ? (
        <Text style={[styles.result, { color: t.TEXT, backgroundColor: t.ACCENT_TINT_BG, borderRadius: t.r(8) }]}>{task.result}</Text>
      ) : null}
      {canAct ? <GoalCardControls task={task} isOwner={isOwner} {...props} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 10, borderLeftWidth: 4, gap: 6 },
  owner: { fontSize: 11, fontFamily: interFamily('400') },
  description: { fontSize: 14, lineHeight: 20, fontFamily: interFamily('400') },
  status: { fontSize: 12, fontFamily: interFamily('400') },
  result: { fontSize: 13, paddingVertical: 6, paddingHorizontal: 8, fontFamily: interFamily('400') },
});
