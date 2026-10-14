// One column of the board (Up for grabs, Doing or Done), copied from the web's Column
// (web components/peer-programming/pp-goals-board.tsx): 82% of the board's width, so the next
// column peeks in from the right and the row scrolls sideways.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { interFamily } from '../../components/ui';
import type { Card } from './ppBoard';
import { GoalCard, type BoardProps } from './GoalCard';
import { PPButton } from './PPButton';
import { usePPTheme } from './usePPTheme';

export function GoalSection({ title, empty, cards, limit, width, ...props }: BoardProps & {
  title: string;
  empty: string;
  cards: Card[];
  limit?: number;
  width: number;
}) {
  const t = usePPTheme();
  const [showAll, setShowAll] = useState(false);
  const shown = limit && !showAll ? cards.slice(0, limit) : cards;
  return (
    <View
      accessibilityLabel={`${title}, ${cards.length}`}
      style={[styles.column, { width, borderRadius: t.r(12), backgroundColor: t.INPUT_BG, borderColor: t.BORDER }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.TITLE }]}>{title}</Text>
        <Text style={[styles.title, { color: t.MUTED }]}>{cards.length}</Text>
      </View>
      {cards.length === 0 ? <Text style={[styles.empty, { color: t.MUTED }]}>{empty}</Text> : null}
      {shown.map((card) => <GoalCard key={card.task.id} card={card} {...props} />)}
      {shown.length < cards.length ? <PPButton label={`Show all ${cards.length}`} onPress={() => setShowAll(true)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { borderWidth: 1, padding: 8, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, paddingHorizontal: 4 },
  title: { fontSize: 13, fontFamily: interFamily('700') },
  empty: { fontSize: 12, paddingTop: 4, paddingHorizontal: 4, paddingBottom: 8, fontFamily: interFamily('400') },
});
