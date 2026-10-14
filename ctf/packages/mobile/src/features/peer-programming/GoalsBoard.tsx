// The goal board, copied from the web board (web components/peer-programming/pp-goals-board.tsx):
// a count of cards done in the last day, the goal chips row, the new goal form or the owner's goal
// panel, then the selected goal's cards in three columns (Up for grabs, Doing, Done) that scroll
// sideways, each 82% of the board's width.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Target } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import type { Board, BoardGoal } from './PeerProgrammingApi';
import { ALL_GOALS, NEW_GOAL, chipGoals, sortIntoSections } from './ppBoard';
import { GoalChips } from './GoalChips';
import { GoalSection } from './GoalSection';
import { NewGoalForm } from './NewGoalForm';
import { YourGoalPanel } from './YourGoalPanel';
import type { BoardProps } from './GoalCard';
import { usePPTheme } from './usePPTheme';

// The Done column keeps growing for two weeks, so it shows the newest cards and a control for the rest.
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
  const t = usePPTheme();
  return (
    <View style={styles.intro}>
      <View style={styles.countRow}>
        <Target size={18} color={t.ACCENT} />
        <Text style={[styles.count, { color: t.TITLE }]}>
          {finishedLastDay === 1 ? '1 card done in the last 24 hours' : `${finishedLastDay} cards done in the last 24 hours`}
        </Text>
      </View>
      <Text style={[styles.lead, { color: t.SUBTLE }]}>
        Grab any one card, do it from your phone, and post what you found. One card is plenty.
      </Text>
    </View>
  );
}

const COLUMN_GAP = 10;

// The three columns, scrolled sideways and snapping to the start of each, as the web row does.
function Columns({ sections, props }: { sections: ReturnType<typeof sortIntoSections>; props: BoardProps }) {
  const [boardWidth, setBoardWidth] = useState(0);
  const width = boardWidth * 0.82;
  return (
    <View onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}>
      {boardWidth > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width + COLUMN_GAP}
          decelerationRate="fast"
          contentContainerStyle={styles.columns}
        >
          <GoalSection title="Up for grabs" empty="Nothing open right now. Add your goal and its cards." cards={sections.grabs} width={width} {...props} />
          <GoalSection title="Doing" empty="Nobody is holding a card." cards={sections.doing} width={width} {...props} />
          <GoalSection title="Done" empty="No cards done yet." cards={sections.done} limit={DONE_SHOWN} width={width} {...props} />
        </ScrollView>
      ) : null}
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
      <Columns sections={sections} props={props} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  intro: { gap: 4 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { flexShrink: 1, fontSize: 15, fontFamily: interFamily('700') },
  lead: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
  columns: { gap: COLUMN_GAP, paddingBottom: 6, alignItems: 'flex-start' },
});
