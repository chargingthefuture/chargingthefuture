// + New on Android, the copy of the web (web components/se-frame/new/new-screen.tsx). Talk books a
// TI Radio slot in the Main Room; Ask, Offer and Story are built with the rest of + New.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SE_NEW_LATER, SE_TALK_WORDS, type SeThemeTokens } from '@ctf/shared';
import type { FeatureKey } from '../../../navigation/screens';
import { SE_FONT } from '../fonts';
import { TalkForm } from './TalkForm';

export function NewScreen({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.title}>
          {SE_TALK_WORDS.title}
        </Text>
        <Text style={s.text}>{SE_TALK_WORDS.intro}</Text>
        <TalkForm t={t} onOpen={onOpen} />
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.title}>
          {SE_NEW_LATER.title}
        </Text>
        <Text style={s.text}>{SE_NEW_LATER.text}</Text>
      </View>
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    title: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
  });
}
