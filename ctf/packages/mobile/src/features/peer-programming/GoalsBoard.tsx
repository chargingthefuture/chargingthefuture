// The goal board on a phone: a count of cards done in the last day, the goal chips row, the new goal
// form or the owner's goal panel, then the selected goal's cards in three stacked sections (Up for
// grabs, Doing, Done). Same rules as the web board (pp-goals-board.tsx); the web's three columns are
// stacked here so each card keeps the full width of the screen.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Board, BoardGoal } from './PeerProgrammingApi';
import { ALL_GOALS, NEW_GOAL, chipGoals, sortIntoSections } from './ppBoard';
import { GoalChips } from './GoalChips';
import { GoalSection } from './GoalSection';
import { NewGoalForm } from './NewGoalForm';
import { YourGoalPanel } from './YourGoalPanel';
import type { BoardProps } from './GoalCard';
import { usePPTheme } from './usePPTheme';

// The Done section keeps growing for two weeks, so it shows the newest cards and a control for the rest.
const DONE_SHOWN = 8;

export type GoalsBoardProps = {
  board: Board;
  busy: boolean;
  onAction: BoardProps['onAction'];
  onEditTask: BoardProps['onEditTask'];
  onAddTask: (_goalId: string, _description: string) => Promise<boolean>;
  onClose: (_goalId: string, _outcome: 'reached' | 'withdrawn') => void;
  onPost: (_title: string, _tasks: string[]) => Promise<boolean>;
};

// Which goal the row has selected, kept valid as the board reloads: a goal that closes or is taken
// down falls back to every goal, and a goal the viewer just posted becomes the selection.
function useSelectedGoal(board: Board, chips: BoardGoal[], canAdd: boolean) {
  const [selected, setSelected] = useState<string>(ALL_GOALS);
  const [knownOwnIds, setKnownOwnIds] = useState<string[] | null>(null);
  const ownIds = chips.filter((goal) => goal.ownerUserId === board.viewerUserId).map((goal) => goal.id);
  if (knownOwnIds === null || ownIds.join() !== knownOwnIds.join()) {
    const posted = knownOwnIds === null ? undefined : ownIds.find((id) => !knownOwnIds.includes(id));
    setKnownOwnIds(ownIds);
    if (posted) setSelected(posted);
  }
  const valid = selected === ALL_GOALS || (selected === NEW_GOAL && canAdd) || chips.some((goal) => goal.id === selected);
  return [valid ? selected : ALL_GOALS, setSelected] as const;
}

function BoardIntro({ finishedLastDay }: { finishedLastDay: number }) {
  const { tokens } = usePPTheme();
  return (
    <View style={styles.intro}>
      <Text style={[styles.count, { color: tokens.textPrimary }]}>
        {finishedLastDay === 1 ? '1 card done in the last 24 hours' : `${finishedLastDay} cards done in the last 24 hours`}
      </Text>
      <Text style={[styles.lead, { color: tokens.textSecondary }]}>
        Grab any one card, do it from your phone, and post what you found. One card is plenty.
      </Text>
    </View>
  );
}

export function GoalsBoard({ board, busy, onAction, onEditTask, onAddTask, onClose, onPost }: GoalsBoardProps) {
  const chips = chipGoals(board.goals, board.viewerUserId);
  const myOpenCount = chips.filter((goal) => goal.ownerUserId === board.viewerUserId).length;
  const canAdd = !board.ended && myOpenCount < board.maxOpenGoals;
  const [selected, setSelected] = useSelectedGoal(board, chips, canAdd);
  const selectedGoal = chips.find((goal) => goal.id === selected);
  const sections = sortIntoSections(selectedGoal ? [selectedGoal] : board.goals);
  const showOwnPanel = !board.ended && selectedGoal !== undefined && selectedGoal.ownerUserId === board.viewerUserId;
  const props: BoardProps = {
    viewerUserId: board.viewerUserId,
    names: board.names,
    readOnly: board.ended,
    busy,
    taskHoldHours: board.taskHoldHours,
    onAction,
    onEditTask,
  };
  return (
    <View style={styles.stack}>
      <BoardIntro finishedLastDay={board.finishedLastDay} />
      <GoalChips goals={chips} selected={selected} viewerUserId={board.viewerUserId} names={board.names} canAdd={canAdd} onSelect={setSelected} />
      {selected === NEW_GOAL ? <NewGoalForm busy={busy} onPost={onPost} onCancel={() => setSelected(ALL_GOALS)} /> : null}
      {showOwnPanel && selectedGoal ? (
        <YourGoalPanel key={selectedGoal.id} goal={selectedGoal} busy={busy} onAddTask={onAddTask} onClose={onClose} />
      ) : null}
      <GoalSection title="Up for grabs" empty="Nothing open right now. Add your goal and its cards." cards={sections.grabs} {...props} />
      <GoalSection title="Doing" empty="Nobody is holding a card." cards={sections.doing} {...props} />
      <GoalSection title="Done" empty="No cards done yet." cards={sections.done} limit={DONE_SHOWN} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  intro: { gap: 4 },
  count: { fontSize: 15, fontWeight: '700' },
  lead: { fontSize: 13, lineHeight: 19 },
});
