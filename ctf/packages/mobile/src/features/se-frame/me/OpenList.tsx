// Me → Open on Android, the copy of the web's open-list.tsx: the cards on the member's Today they are
// part of and that are not done (seOpenCards), read from the same GET /api/today the Today tab draws.
// Tapping one opens it in place, as on Today (CardRow.tsx, shared with Read and Hidden).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SE_ME_WORDS, SE_OPEN_WORDS as W, seOpenCards, seTodayDayQuery, seTodayView, type SeOpenItem, type SeThemeTokens, type SeToday, type SeTodayCard } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';
import { CardSheet } from '../today/CardSheet';
import { CardRow } from './CardRow';
import { makeMeStyles, type MeStyles } from './meStyles';
import { BackHeader } from './SettingsParts';

type OpenState = { kind: 'loading' } | { kind: 'ready'; items: SeOpenItem[]; missing: string | null } | { kind: 'error'; message: string };

function useOpenCards(viewerId: string) {
  const [state, setState] = useState<OpenState>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const { today } = await authedFetchJson<{ today: SeToday }>(`/api/today?${seTodayDayQuery()}`);
      setState({ kind: 'ready', items: seOpenCards(today.cards, viewerId), missing: seTodayView(today, { read: [], hidden: [] }, 'all').missingLine });
    } catch (error) {
      reportError(error, { area: 'se-frame', op: 'me_open' });
      setState({ kind: 'error', message: error instanceof Error && error.message ? `${W.failed} ${error.message}` : W.failed });
    }
  }, [viewerId]);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

function OpenItem({ s, t, item }: { s: MeStyles; t: SeThemeTokens; item: SeOpenItem }) {
  const { card } = item;
  return (
    <>
      <Text style={[s.q, { color: t.kind[card.kind] }]}>{card.label}</Text>
      <Text style={s.itemTitle}>{card.title}</Text>
      <Text style={s.q}>{item.line}</Text>
    </>
  );
}

type Props = { t: SeThemeTokens; viewerId: string; onBack: () => void; go: (_href: string) => void };

export function OpenList({ t, viewerId, onBack, go }: Props) {
  const s = useMemo(() => makeMeStyles(t), [t]);
  const { state, reload } = useOpenCards(viewerId);
  const [sheet, setSheet] = useState<SeTodayCard | null>(null);
  return (
    <View style={s.stack}>
      <BackHeader s={s} t={t} title={W.title} back={SE_ME_WORDS.backToMe} onBack={onBack} />
      <Text style={s.text}>{W.intro}</Text>
      {state.kind === 'loading' ? <Text style={s.status}>{W.loading}</Text> : null}
      {state.kind === 'error' ? (
        <Text accessibilityRole="alert" style={s.alert}>
          {state.message}
        </Text>
      ) : null}
      {state.kind === 'ready' && state.missing ? <Text style={s.status}>{state.missing}</Text> : null}
      {state.kind === 'ready' && state.items.length === 0 ? <Text style={s.status}>{W.empty}</Text> : null}
      {state.kind === 'ready' ? state.items.map((item) => (
            <CardRow key={item.card.id} s={s} card={item.card} onSheet={setSheet} go={go}>
              <OpenItem s={s} t={t} item={item} />
            </CardRow>
          )) : null}
      {sheet ? <CardSheet t={t} card={sheet} viewerId={viewerId} firstAnswer={null} onClose={() => setSheet(null)} onOpenLink={go} onChanged={() => void reload()} /> : null}
    </View>
  );
}
