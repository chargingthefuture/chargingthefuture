// The controls a Today card carries in its own row on Android, the copy of the web's
// card-quick-actions.tsx: Save for later and Hide as icons on a story or replay, and the Mood card's
// five faces, each of which is the check-in.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SE_SAVED_WORDS, SE_TODAY_MOOD_TITLE, SE_TODAY_MOOD_WORDS, SE_TODAY_MOODS, type SeThemeTokens, type SeTodayCard } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import { SE_FONT } from '../fonts';

export function SaveHideIcons({ t, card, onSave, onHide }: { t: SeThemeTokens; card: SeTodayCard; onSave: () => void; onHide: () => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const saved = card.saved === true;
  return (
    <>
      <View style={s.spacer} />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={saved ? SE_SAVED_WORDS.unsave : SE_SAVED_WORDS.save}
        accessibilityState={{ selected: saved }}
        onPress={onSave}
        style={[s.icon, saved ? s.iconOn : null]}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d="M6 4h12v16l-6-4-6 4z" fill={saved ? t.ink : 'none'} stroke={t.ink} strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={SE_SAVED_WORDS.hide} onPress={onHide} style={s.icon}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path
            d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.2M6.6 6.6C4.4 8.1 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 4-1"
            fill="none"
            stroke={t.ink}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </TouchableOpacity>
    </>
  );
}

async function checkIn(value: number): Promise<string | null> {
  try {
    await authedFetchJson('/api/mood/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ clientId: `android-today-${Date.now()}-${Math.random().toString(36).slice(2)}`, moodValue: value, note: null }),
    });
    return null;
  } catch (error) {
    return `${SE_TODAY_MOOD_WORDS.failed} ${error instanceof Error ? error.message : ''}`.trim();
  }
}

export function MoodFaces({ t }: { t: SeThemeTokens }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const pick = async (value: number) => {
    setChosen(value);
    setState('saving');
    setError(null);
    const failure = await checkIn(value);
    setError(failure);
    setState(failure ? 'idle' : 'saved');
  };
  const label = SE_TODAY_MOODS.find((mood) => mood.value === chosen)?.label ?? '';
  return (
    <>
      <View style={s.faces} accessibilityLabel={SE_TODAY_MOOD_TITLE}>
        {SE_TODAY_MOODS.map((mood) => {
          const on = chosen === mood.value;
          return (
            <TouchableOpacity
              key={mood.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: state !== 'idle' }}
              disabled={state !== 'idle'}
              onPress={() => void pick(mood.value)}
              style={[s.face, on ? s.faceOn : null]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={9} fill="none" stroke={t.ink} strokeWidth={2.2} />
                <Path d={mood.mouth} fill="none" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" />
              </Svg>
              <Text style={s.faceLabel}>{mood.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {state === 'saving' ? <Text style={s.note}>{SE_TODAY_MOOD_WORDS.saving}</Text> : null}
      {state === 'saved' ? <Text style={s.note}>{SE_TODAY_MOOD_WORDS.saved(label)}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={s.note}>
          {error}
        </Text>
      ) : null}
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    spacer: { flex: 1 },
    icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: t.hair, alignItems: 'center', justifyContent: 'center' },
    iconOn: { borderColor: t.line, backgroundColor: t.sunk },
    faces: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 18, backgroundColor: t.sunk },
    face: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 2, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
    faceOn: { borderColor: t.line, backgroundColor: t.card },
    faceLabel: { fontSize: 11, lineHeight: 13, textAlign: 'center', color: t.ink, fontFamily: SE_FONT.sansSemi },
    note: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
  });
}
