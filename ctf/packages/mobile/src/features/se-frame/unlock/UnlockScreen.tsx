// The Unlock screen in the 3.1 frame on Android, the copy of the web's unlock/unlock-screen.tsx:
// everything the 3.0 Unlock screen does for a member, in the 3.1 design. It opens from the banner's
// "Why this step", People's and + New → Talk's "Finish Unlock". The phone's back button closes it.

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SE_UNLOCK_SCREEN_WORDS as W, type SeThemeTokens } from '@ctf/shared';
import { UnlockStageCard } from './UnlockStageCard';
import { UnlockRemovedRoutes } from './UnlockRemovedRoutes';
import { UnlockHelp } from './UnlockHelp';
import { UnlockWhy } from './UnlockWhy';
import { makeUnlockStyles, type UnlockStyles } from './unlockStyles';
import { useUnlockScreen, type SeUnlockScreenData } from './useUnlockScreen';

export function UnlockScreen({ t, onBack, onToday }: { t: SeThemeTokens; onBack: () => void; onToday: () => void }) {
  const s = useMemo(() => makeUnlockStyles(t), [t]);
  const { data, reload } = useUnlockScreen();
  return (
    <View style={s.stack}>
      <View style={s.top}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.back} onPress={onBack} style={s.back}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        <Text accessibilityRole="header" style={s.title}>
          {W.title}
        </Text>
      </View>
      <Text style={s.lead}>{W.lead}</Text>
      <Body s={s} t={t} data={data} reload={reload} onToday={onToday} />
      <UnlockWhy s={s} />
    </View>
  );
}

type BodyProps = { s: UnlockStyles; t: SeThemeTokens; data: SeUnlockScreenData; reload: () => void; onToday: () => void };

function Body({ s, t, data, reload, onToday }: BodyProps) {
  if (data.kind === 'loading') return <Text style={s.note}>{W.loading}</Text>;
  if (data.kind === 'error') {
    return (
      <View style={s.card}>
        <Text accessibilityRole="alert" style={s.text}>
          {data.message}
        </Text>
        <TouchableOpacity accessibilityRole="button" onPress={reload} style={s.secondary}>
          <Text style={s.secondaryLabel}>{W.tryAgain}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  // Help finding the address stays offered until approval, as on the 3.0 page, waiting included.
  const open = data.stage !== 'approved';
  return (
    <>
      <UnlockStageCard s={s} t={t} stage={data.stage} standing={data.standing} helpAsked={data.helpAsked} onSent={reload} onToday={onToday} />
      {data.stage === 'send' ? <UnlockRemovedRoutes s={s} onFinished={reload} /> : null}
      {open ? <UnlockHelp s={s} t={t} onAsked={reload} /> : null}
    </>
  );
}
