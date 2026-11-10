// + New → Talk on Android, the copy of the web (web components/se-frame/new/talk-form.tsx): book an
// empty 90 minutes on TI Radio, held in the Chyme Main Room, through the same routes the TI Radio
// guide uses. A member not verified yet sees why, and the next talk they can listen to.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SE_TALK_WORDS as W, seTalkIntro, type SeTalkSlot, type SeThemeTokens } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import type { FeatureKey } from '../../../navigation/screens';
import { SE_FONT } from '../fonts';
import { makeSheetStyles } from './sheetStyles';
import { TalkBook } from './TalkBook';
import { TalkLocked } from './TalkLocked';

type Guide = { slots: SeTalkSlot[]; viewer: { canHost: boolean } };
type GuideState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; guide: Guide };

function useGuide() {
  const [state, setState] = useState<GuideState>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const payload = await authedFetchJson<{ guide: Guide }>('/api/ti-radio/guide');
      setState({ kind: 'ready', guide: payload.guide });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : W.loadFailed });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

type BodyProps = { t: SeThemeTokens; s: ReturnType<typeof makeStyles>; state: GuideState; reload: () => Promise<void>; onOpen: (_key: FeatureKey) => void };

function TalkBody({ t, s, state, reload, onOpen }: BodyProps) {
  if (state.kind === 'loading') return <Text style={s.text}>{W.loading}</Text>;
  if (state.kind === 'error') {
    return (
      <Text accessibilityRole="alert" style={s.error}>
        {state.message}{' '}
        <Text accessibilityRole="button" onPress={() => void reload()} style={s.link}>
          {W.tryAgain}
        </Text>
      </Text>
    );
  }
  if (!state.guide.viewer.canHost) return <TalkLocked t={t} slots={state.guide.slots} onOpen={onOpen} />;
  return <TalkBook t={t} slots={state.guide.slots} reload={reload} />;
}

export function TalkForm({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const sh = useMemo(() => makeSheetStyles(t), [t]);
  const { state, reload } = useGuide();
  return (
    <>
      <View style={sh.headLeft}>
        <Text accessibilityRole="header" style={sh.titleSmall}>
          {W.heading}
        </Text>
        <Text style={sh.sub}>{seTalkIntro()}</Text>
      </View>
      <TalkBody t={t} s={s} state={state} reload={reload} onOpen={onOpen} />
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    link: { color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
    error: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}
