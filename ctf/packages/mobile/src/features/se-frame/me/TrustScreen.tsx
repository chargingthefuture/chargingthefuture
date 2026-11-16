// Me → Trust on Android, the copy of the web's trust-screen.tsx: the member's own lines, recomputed
// from what they have done, then exactly what any other member gets. Nothing here is a setting and
// nothing is a score.

import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SE_ME_WORDS, SE_TRUST_SELF_PATH, SE_TRUST_WORDS as W, type SeThemeTokens } from '@ctf/shared';
import { TrustReadView } from '../trust/TrustLines';
import { useTrust } from '../trust/useTrust';
import { makeMeStyles } from './meStyles';
import { BackHeader } from './SettingsParts';

export function TrustScreen({ t, onBack }: { t: SeThemeTokens; onBack: () => void }) {
  const s = useMemo(() => makeMeStyles(t), [t]);
  const [attempt, setAttempt] = useState(0);
  const read = useTrust(SE_TRUST_SELF_PATH, attempt);
  return (
    <View style={s.stack}>
      <BackHeader s={s} t={t} title={W.title} back={SE_ME_WORDS.backToMe} onBack={onBack} />
      <Text style={s.text}>{W.meRow}</Text>
      <TrustReadView t={t} read={read} own onRetry={() => setAttempt((n) => n + 1)} />
    </View>
  );
}
