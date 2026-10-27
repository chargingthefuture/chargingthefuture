// + New on Android, the copy of the web (web components/se-frame/new/new-screen.tsx). Ask is posted
// here; Talk books a TI Radio slot; an Offer or a Story opens where it is made (in the app for
// Foundation, in the browser for the rest).

import React, { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_ASK_WORDS, SE_OFFER_CHOICES, SE_OFFER_WORDS, SE_STORY_WORDS, SE_TALK_WORDS, type SeThemeTokens } from '@ctf/shared';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import { SE_FONT } from '../fonts';
import { AskForm } from './AskForm';
import { TalkForm } from './TalkForm';

type Styles = ReturnType<typeof makeStyles>;

function Section({ s, title, intro, children }: { s: Styles; title: string; intro: string; children: ReactNode }) {
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      <Text style={s.text}>{intro}</Text>
      {children}
    </View>
  );
}

function Choice({ s, title, text, onPress }: { s: Styles; title: string; text?: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="link" onPress={onPress} style={s.choice}>
      <Text style={s.choiceTitle}>{title}</Text>
      {text ? <Text style={s.text}>{text}</Text> : null}
    </TouchableOpacity>
  );
}

export function NewScreen({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const go = (href: string) => openTodayLink(href, onOpen);
  return (
    <>
      <Section s={s} title={SE_ASK_WORDS.title} intro={SE_ASK_WORDS.intro}>
        <AskForm t={t} />
      </Section>
      <Section s={s} title={SE_OFFER_WORDS.title} intro={SE_OFFER_WORDS.intro}>
        {SE_OFFER_CHOICES.map((choice) => (
          <Choice key={choice.key} s={s} title={choice.label} text={choice.text} onPress={() => go(choice.href)} />
        ))}
      </Section>
      <Section s={s} title={SE_STORY_WORDS.title} intro={SE_STORY_WORDS.intro}>
        <Choice s={s} title={SE_STORY_WORDS.open} onPress={() => go(SE_STORY_WORDS.href)} />
      </Section>
      <Section s={s} title={SE_TALK_WORDS.title} intro={SE_TALK_WORDS.intro}>
        <TalkForm t={t} onOpen={onOpen} />
      </Section>
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    title: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    choice: { gap: 4, minHeight: 44, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg },
    choiceTitle: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}
