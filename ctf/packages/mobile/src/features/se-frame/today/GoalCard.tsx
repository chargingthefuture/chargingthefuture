// The viewer's own PeerProgramming goal on Today, the Android copy of the web's goal-card.tsx (the
// approved 3.1 board "Today, a quiet day"): the label says how many of its tasks are taken, a bar
// shows it, and Share this goal opens the share picture. An open goal opens in place like any ask,
// with the poster's Done and keep-up controls; a reached goal opens the board.

import React, { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_GOAL_SHARE_WORDS, seGoalPercent, type SeThemeTokens, type SeTodayCard, type SeTodayGoal } from '@ctf/shared';
import { SE_FONT } from '../fonts';
import { GoalShareSheet } from '../share/GoalShareSheet';
import { CardSheet } from './CardSheet';

type Props = {
  t: SeThemeTokens;
  card: SeTodayCard & { goal: SeTodayGoal };
  viewerId: string;
  dot: ReactNode;
  onOpenLink: (_href: string) => void;
  onChanged?: () => void;
};

export function GoalCard({ t, card, viewerId, dot, onOpenLink, onChanged }: Props) {
  const [sheet, setSheet] = useState(false);
  const [share, setShare] = useState(false);
  const s = makeStyles(t);
  const percent = seGoalPercent(card.goal);
  const sharer = card.author ? { handle: card.author.handle, accountId: card.author.accountId } : null;
  return (
    <View style={s.card}>
      {dot}
      <TouchableOpacity accessibilityRole={card.goal.reached ? 'link' : 'button'} style={s.text} onPress={() => (card.goal.reached ? onOpenLink(card.href) : setSheet(true))}>
        <Text style={s.label}>{card.label}</Text>
        <Text style={s.title}>{card.title}</Text>
      </TouchableOpacity>
      <View style={s.bar} accessibilityRole="progressbar" accessibilityLabel={card.label} accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={[s.fill, { width: `${percent}%` }]} />
      </View>
      <TouchableOpacity accessibilityRole="button" style={s.share} onPress={() => setShare(true)}>
        <Text style={s.shareLabel}>{SE_GOAL_SHARE_WORDS.shareThisGoal}</Text>
      </TouchableOpacity>
      {sheet ? <CardSheet t={t} card={card} viewerId={viewerId} firstAnswer={null} onClose={() => setSheet(false)} onOpenLink={onOpenLink} onChanged={onChanged} /> : null}
      {share ? <GoalShareSheet share={{ ...card.goal, title: card.title }} sharer={sharer} onClose={() => setShare(false)} /> : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    text: { gap: 6 },
    label: { fontSize: 12, color: t.kind.ask, fontFamily: SE_FONT.sansBold },
    title: { fontSize: 17, lineHeight: 22, color: t.ink, fontFamily: SE_FONT.sansBold },
    bar: { height: 8, borderRadius: 999, backgroundColor: t.sunk, overflow: 'hidden' },
    fill: { height: 8, backgroundColor: t.kind.ask },
    share: {
      alignSelf: 'flex-start',
      minHeight: 40,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
      boxShadow: `0px 2px 0px ${t.line}`,
    },
    shareLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
  });
}
