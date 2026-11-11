// Me → Saved on Android, the copy of the web (web components/se-frame/me/saved-card.tsx): the stories
// and replays this member saved for later from Today (GET /api/today/saves), newest first, each
// opening where it lives, with Remove.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_SAVED_WORDS as W, seSavedKindName, type SeSavedCard, type SeThemeTokens } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import { SE_FONT } from '../fonts';

const CSRF = { 'content-type': 'application/json', 'x-ctf-csrf': '1' };

function useSaves() {
  const [saves, setSaves] = useState<SeSavedCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (work: () => Promise<unknown>, lead: string) => {
    try {
      await work();
      const body = await authedFetchJson<{ saves: SeSavedCard[] }>('/api/today/saves');
      setSaves(body.saves);
      setError(null);
    } catch (failure) {
      setError(`${lead} ${failure instanceof Error ? failure.message : ''}`.trim());
    }
  }, []);
  useEffect(() => {
    void run(async () => undefined, W.loadFailed);
  }, [run]);
  return { saves, error, run };
}

export function SavedCard({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { saves, error, run } = useSaves();
  const remove = (cardId: string) =>
    void run(() => authedFetchJson('/api/today/saves', { method: 'POST', headers: CSRF, body: JSON.stringify({ cardId, saved: false }) }), W.failed);
  return (
    <View style={s.card}>
      <Text style={s.label}>{W.title}</Text>
      <Text style={s.text}>{W.intro}</Text>
      {saves === null && !error ? <Text style={s.text}>Loading…</Text> : null}
      {saves?.length === 0 ? <Text style={s.text}>{W.empty}</Text> : null}
      {saves?.map((save) => (
        <View key={save.cardId} style={s.row}>
          <TouchableOpacity accessibilityRole="link" onPress={() => openTodayLink(save.href, onOpen)} style={s.link}>
            <Text style={s.kind}>{seSavedKindName(save.kind)}</Text>
            <Text style={s.title}>{save.title}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => remove(save.cardId)} style={s.pill}>
            <Text style={s.pillLabel}>{W.remove}</Text>
          </TouchableOpacity>
        </View>
      ))}
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
    link: { flex: 1, minHeight: 44, justifyContent: 'center' },
    kind: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansBold },
    title: { fontSize: 15, lineHeight: 20, color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansSemi },
    pill: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    pillLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}
