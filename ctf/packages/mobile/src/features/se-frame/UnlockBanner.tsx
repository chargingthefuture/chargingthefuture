// The Unlock banner on every 3.1 screen on Android, the copy of the web
// (web components/se-frame/unlock-banner.tsx): the day count, the way to finish, and, after day 14,
// that posting is paused. It can be closed only in the first week, and only until the next visit.
// An approved member never sees it.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_UNLOCK_WORDS as W, type SeThemeTokens, type SeUnlockStanding } from '@ctf/shared';
import { authedFetchJson } from '../../auth/authedFetch';
import { SE_FONT } from './fonts';

export function UnlockBanner({ t, onOpenUnlock }: { t: SeThemeTokens; onOpenUnlock: () => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const [standing, setStanding] = useState<SeUnlockStanding | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let active = true;
    authedFetchJson<{ standing?: SeUnlockStanding }>('/api/unlock/standing')
      .then((body) => {
        if (active) setStanding(body.standing ?? null);
      })
      .catch(() => {
        // no-trace: without the standing the banner stays away; every gated route still says why.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!standing || standing.approved || closed) return null;
  const paused = standing.paused;
  return (
    <View style={[s.banner, paused ? s.paused : null]} accessibilityLabel="Unlock">
      <Text style={[s.title, paused ? s.inkText : null]}>{standing.title}</Text>
      <Text style={[s.text, paused ? s.inkText : null]}>{standing.text}</Text>
      <View style={s.row}>
        <TouchableOpacity accessibilityRole="link" onPress={onOpenUnlock} style={[s.button, paused ? s.inkBorder : null]}>
          <Text style={[s.buttonLabel, paused ? s.inkText : null]}>{W.open}</Text>
        </TouchableOpacity>
        {standing.closable ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setClosed(true)} style={s.button}>
            <Text style={s.buttonLabel}>{W.close}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    banner: { gap: 6, padding: 14, borderRadius: 18, backgroundColor: t.hero },
    paused: { backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line },
    title: { fontSize: 15, color: t.onHero, fontFamily: SE_FONT.sansBold },
    text: { fontSize: 14, lineHeight: 20, color: t.onHero, fontFamily: SE_FONT.sans },
    inkText: { color: t.ink },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
    button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.onHero },
    inkBorder: { borderColor: t.line },
    buttonLabel: { fontSize: 14, color: t.onHero, fontFamily: SE_FONT.sansBold },
  });
}
