// Me → Read and Hidden on Android, the copy of the web's marked-list.tsx: the cards the member marked
// done, or Not for me, that are still around (GET /api/today/marks?mark=…, which answers the full
// card). Tapping one opens it in place, the same sheet as Today and Me → Open.

import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SE_ME_WORDS as W, type SeThemeTokens, type SeTodayCard } from '@ctf/shared';
import { CardSheet } from '../today/CardSheet';
import { CardRow } from './CardRow';
import { makeMeStyles } from './meStyles';
import { useMarked } from './meData';
import { BackHeader } from './SettingsParts';

type Props = { t: SeThemeTokens; mark: 'done' | 'not_for_me'; viewerId: string; onBack: () => void; go: (_href: string) => void };

export function MarkedList({ t, mark, viewerId, onBack, go }: Props) {
  const s = useMemo(() => makeMeStyles(t), [t]);
  const { state, reload } = useMarked(mark);
  const [sheet, setSheet] = useState<SeTodayCard | null>(null);
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
            <CardRow key={card.id} s={s} card={card} onSheet={setSheet} go={go}>
              <Text style={[s.q, { color: t.kind[card.kind] }]}>{card.label}</Text>
              <Text style={s.itemTitle}>{card.title}</Text>
            </CardRow>
          ))
        : null}
      {sheet ? <CardSheet t={t} card={sheet} viewerId={viewerId} firstAnswer={null} onClose={() => setSheet(null)} onOpenLink={go} onChanged={reload} /> : null}
    </View>
  );
}
