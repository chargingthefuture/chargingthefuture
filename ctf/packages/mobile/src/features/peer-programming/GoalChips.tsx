// The row of goals above the board, scrolled sideways. "All goals" shows every card; pressing a goal
// narrows the columns to that goal's cards; "+ Add your goal" opens the new goal form and hides once
// the member has as many open goals as the board allows. Same order as the web: the viewer's own
// open goals first, then everyone else's, newest first.
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { interFamily } from '../../components/ui';
import type { BoardGoal } from './PeerProgrammingApi';
import { ALL_GOALS, NEW_GOAL, doneCount, goalColor, nameOf } from './ppBoard';
import { usePPTheme } from './usePPTheme';

function Chip({ selected, label, detail, color, onPress }: {
  selected: boolean;
  label: string;
  detail?: string;
  color?: string;
  onPress: () => void;
}) {
  const t = usePPTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          borderRadius: t.r(8),
          borderColor: selected ? t.ACCENT_TAB_BORDER : t.BORDER_STRONG,
          backgroundColor: selected ? t.ACCENT_TINT_BG : 'transparent',
          paddingLeft: color ? 14 : 12,
        },
      ]}
    >
      {/* The goal's color as a stripe inside the left edge, as the web's inset shadow draws it. */}
      {color ? <View style={[styles.stripe, { backgroundColor: color }]} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color: selected ? t.ACCENT : t.SUBTLE }]}>{label}</Text>
      {detail ? <Text numberOfLines={1} style={[styles.detail, { color: t.MUTED }]}>{detail}</Text> : null}
    </TouchableOpacity>
  );
}

export function GoalChips({ goals, selected, viewerUserId, names, canAdd, onSelect }: {
  goals: BoardGoal[];
  selected: string;
  viewerUserId: string;
  names: Record<string, string>;
  canAdd: boolean;
  onSelect: (_key: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip selected={selected === ALL_GOALS} label="All goals" onPress={() => onSelect(ALL_GOALS)} />
      {goals.map((goal) => (
        <Chip
          key={goal.id}
          selected={selected === goal.id}
          label={goal.title}
          detail={`${goal.ownerUserId === viewerUserId ? 'Yours' : nameOf(goal.ownerUserId, names)} · ${doneCount(goal)} of ${goal.tasks.length} done`}
          color={goalColor(goal.id)}
          onPress={() => onSelect(goal.id)}
        />
      ))}
      {canAdd ? <Chip selected={selected === NEW_GOAL} label="+ Add your goal" onPress={() => onSelect(NEW_GOAL)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 4 },
  chip: { borderWidth: 1, paddingVertical: 6, paddingRight: 12, maxWidth: 200, gap: 2, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  label: { fontSize: 13, fontFamily: interFamily('600') },
  detail: { fontSize: 11, fontFamily: interFamily('400') },
});
