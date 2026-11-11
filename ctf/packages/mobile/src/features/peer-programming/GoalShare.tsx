// Share this goal on the board, the Android copy of the web's pp-goal-share.tsx: on the member's own
// open goal (in its panel) and on their goals reached in the last two weeks (the row below). Opens
// the 3.1 share picture; only a goal's owner is offered it, and the picture never names who helped.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SE_GOAL_SHARE_WORDS, seGoalProgress } from '@ctf/shared';
import { interFamily } from '../../components/ui';
import { GoalShareSheet } from '../se-frame/share/GoalShareSheet';
import type { Board, BoardGoal } from './PeerProgrammingApi';
import { PPButton } from './PPButton';
import { usePPTheme } from './usePPTheme';

export function ShareGoalButton({ goal, board }: { goal: BoardGoal; board: Pick<Board, 'names' | 'viewerUserId'> }) {
  const [open, setOpen] = useState(false);
  const handle = board.names[board.viewerUserId];
  const share = { ...seGoalProgress(goal.tasks, goal.ownerUserId, goal.status === 'reached'), title: goal.title };
  return (
    <>
      <PPButton label={SE_GOAL_SHARE_WORDS.shareThisGoal} onPress={() => setOpen(true)} />
      {open ? <GoalShareSheet share={share} sharer={handle ? { handle, accountId: board.viewerUserId } : null} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ReachedGoals({ board }: { board: Board }) {
  const t = usePPTheme();
  const reached = board.goals.filter((goal) => goal.status === 'reached' && goal.ownerUserId === board.viewerUserId);
  if (reached.length === 0) return null;
  return (
    <View accessibilityLabel="Your goals reached" style={styles.stack}>
      <Text accessibilityRole="header" style={[styles.heading, { color: t.TITLE }]}>
        Your goals reached
      </Text>
      {reached.map((goal) => (
        <View key={goal.id} style={[styles.item, { backgroundColor: t.SURFACE, borderColor: t.BORDER, borderRadius: t.r(10) }]}>
          <Text style={[styles.title, { color: t.TEXT }]}>{goal.title}</Text>
          <View style={styles.row}>
            <ShareGoalButton goal={goal} board={board} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  heading: { fontSize: 13, fontFamily: interFamily('700') },
  item: { padding: 10, borderWidth: 1, gap: 6 },
  title: { fontSize: 14, lineHeight: 20, fontFamily: interFamily('400') },
  row: { flexDirection: 'row' },
});
