// Me → Muted on Android, the copy of the web (web components/se-frame/me/muted-card.tsx): the people
// and words this member muted, each with Unmute, and a box to mute words.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_MUTE_WORDS as W, type SeMute, type SeThemeTokens } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import { SE_FONT } from '../fonts';

const CSRF = { 'content-type': 'application/json', 'x-ctf-csrf': '1' };

function useMutes() {
  const [mutes, setMutes] = useState<SeMute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (work: () => Promise<unknown>) => {
    try {
      await work();
      const body = await authedFetchJson<{ mutes: SeMute[] }>('/api/account/mutes');
      setMutes(body.mutes);
      setError(null);
    } catch (failure) {
      setError(`${W.failed} ${failure instanceof Error ? failure.message : ''}`.trim());
    }
  }, []);
  useEffect(() => {
    void run(async () => undefined);
  }, [run]);
  return { mutes, error, run };
}

export function MutedCard({ t }: { t: SeThemeTokens }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { mutes, error, run } = useMutes();
  const [words, setWords] = useState('');
  const add = () => {
    if (!words.trim()) return;
    const target = words;
    setWords('');
    void run(() => authedFetchJson('/api/account/mutes', { method: 'POST', headers: CSRF, body: JSON.stringify({ kind: 'words', target }) }));
  };
  const remove = (id: string) => void run(() => authedFetchJson(`/api/account/mutes/${id}`, { method: 'DELETE', headers: CSRF }));
  return (
    <View style={s.card}>
      <Text style={s.label}>{W.title}</Text>
      <Text style={s.text}>{W.intro}</Text>
      {mutes.length === 0 ? <Text style={s.text}>{W.empty}</Text> : null}
      {mutes.map((mute) => (
        <View key={mute.id} style={s.row}>
          <Text style={s.item}>{mute.kind === 'person' ? (mute.label ?? 'A member') : `“${mute.target}”`}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => remove(mute.id)} style={s.pill}>
            <Text style={s.pillLabel}>{W.remove}</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={s.row}>
        <TextInput accessibilityLabel={W.addWords} placeholder={W.addPlaceholder} placeholderTextColor={t.soft} value={words} maxLength={60} onChangeText={setWords} style={s.input} />
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !words.trim() }} disabled={!words.trim()} onPress={add} style={[s.pill, !words.trim() ? s.disabled : null]}>
          <Text style={s.pillLabel}>{W.add}</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={s.text}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    label: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansBold },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    item: { flex: 1, fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    input: { flex: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg, color: t.ink, fontSize: 16, fontFamily: SE_FONT.sans },
    pill: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    pillLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    disabled: { opacity: 0.6 },
  });
}
