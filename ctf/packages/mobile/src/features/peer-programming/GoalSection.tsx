// One stacked section of the board (Up for grabs, Doing or Done). The web lays these out as three
// columns; on a phone they stack, one under the other.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Card } from './ppBoard';
import { GoalCard, type BoardProps } from './GoalCard';
import { PPButton } from './PPButton';
import { usePPTheme } from './usePPTheme';

export function GoalSection({ title, empty, cards, limit, ...props }: BoardProps & {
  title: string;
  empty: string;
  cards: Card[];
  limit?: number;
}) {
  const { tokens } = usePPTheme();
  const [showAll, setShowAll] = useState(false);
  const shown = limit && !showAll ? cards.slice(0, limit) : cards;
  return (
    <View accessibilityLabel={`${title}, ${cards.length}`} style={[styles.section, { borderColor: tokens.border, borderRadius: tokens.radius }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
        <Text style={[styles.count, { color: tokens.textMuted }]}>{cards.length}</Text>
      </View>
      {cards.length === 0 ? <Text style={[styles.empty, { color: tokens.textMuted }]}>{empty}</Text> : null}
      {shown.map((card) => <GoalCard key={card.task.id} card={card} {...props} />)}
      {shown.length < cards.length ? <PPButton label={`Show all ${cards.length}`} onPress={() => setShowAll(true)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, padding: 8, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  title: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 14, fontWeight: '700' },
  empty: { fontSize: 12, paddingHorizontal: 4, paddingBottom: 4 },
});
