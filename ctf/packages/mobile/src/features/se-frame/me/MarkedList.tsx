// Me → Read and Hidden on Android, the copy of the web's marked-list.tsx: the cards the member marked
// done, or Not for me, that are still around. Each opens where the card's item lives.

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_ME_WORDS as W, type SeThemeTokens } from '@ctf/shared';
import { makeMeStyles } from './meStyles';
import { useMarked } from './meData';
import { BackHeader } from './SettingsParts';

type Props = { t: SeThemeTokens; mark: 'done' | 'not_for_me'; onBack: () => void; go: (_href: string) => void };

export function MarkedList({ t, mark, onBack, go }: Props) {
  const s = useMemo(() => makeMeStyles(t), [t]);
  const state = useMarked(mark);
  return (
    <View style={s.stack}>
      <BackHeader s={s} t={t} title={mark === 'done' ? W.read : W.hidden} back={W.backToMe} onBack={onBack} />
      <Text style={s.text}>{mark === 'done' ? W.readIntro : W.hiddenIntro}</Text>
      {state.kind === 'loading' ? <Text style={s.status}>…</Text> : null}
      {state.kind === 'error' ? (
        <Text accessibilityRole="alert" style={s.alert}>
          {state.message}
        </Text>
      ) : null}
      {state.kind === 'ready' && state.value.length === 0 ? <Text style={s.status}>{W.listEmpty}</Text> : null}
      {state.kind === 'ready'
        ? state.value.map((card) => (
            <TouchableOpacity key={card.id} accessibilityRole="link" onPress={() => go(card.href)} style={s.listItem}>
              <Text style={[s.q, { color: t.kind[card.kind] }]}>{card.label}</Text>
              <Text style={s.itemTitle}>{card.title}</Text>
            </TouchableOpacity>
          ))
        : null}
    </View>
  );
}
