// The large figures on a card that carries them, the Android copy of the web's card-figures.tsx (the
// Our numbers card on the approved board "More cards in Today"): each figure over its line, two to a
// row on the page color. They take the place of the title and text.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SeThemeTokens, SeTodayCard } from '@ctf/shared';
import { SE_FONT } from '../fonts';

export function CardFigures({ t, card }: { t: SeThemeTokens; card: SeTodayCard }) {
  if (!card.figures?.length) return null;
  const s = makeStyles(t);
  return (
    <View style={s.figures}>
      {card.figures.map((figure) => (
        <View key={figure.line} style={s.figure}>
          <Text style={s.value}>{figure.value}</Text>
          <Text style={s.line}>{figure.line}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    figures: { flexDirection: 'row', gap: 10 },
    figure: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: t.bg },
    value: { fontSize: 30, lineHeight: 32, color: t.ink, fontFamily: SE_FONT.serif },
    line: { fontSize: 12, lineHeight: 16, color: t.soft, fontFamily: SE_FONT.sans },
  });
}
