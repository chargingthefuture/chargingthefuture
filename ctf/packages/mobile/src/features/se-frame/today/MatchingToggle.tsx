// 21 Questions matching on Android, the copy of the web (web components/se-frame/today/matching-toggle.tsx):
// under Matches on Today and on Me. Shows nothing until the member has answered a question, or when
// they cannot use 21 Questions. Only this toggle changes matching; answering never turns it back on.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SE_MATCHING_WORDS as W, seMatchingToggleShown, type SeMatchingState, type SeThemeTokens } from '@ctf/shared';
import { authedFetch, authedFetchJson } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';
import { SE_FONT } from '../fonts';

const URL = '/api/today/questions/matching';

function useMatching(refreshKey: string | undefined) {
  const [state, setState] = useState<SeMatchingState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A member who cannot use 21 Questions (not approved yet) gets 401 or 403: no toggle, nothing to
  // report. Any other failure also hides the toggle, and is reported so it is not lost.
  const load = useCallback(async () => {
    try {
      const res = await authedFetch(URL);
      if (res.status === 401 || res.status === 403) return setState(null);
      const data = (await res.json().catch(() => null)) as (SeMatchingState & { message?: string }) | null;
      if (!res.ok || !data) throw new Error(data?.message ?? `Matching could not be read (HTTP ${res.status}).`);
      setState({ answered: data.answered, enabled: data.enabled });
    } catch (failure) {
      reportError(failure, { area: 'questions', op: 'read_matching' });
      setState(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  const set = async (enabled: boolean): Promise<boolean> => {
    setBusy(true);
    try {
      const data = await authedFetchJson<SeMatchingState>(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ enabled }),
      });
      setNote(null);
      setState({ answered: data.answered, enabled: data.enabled });
      return true;
    } catch (failure) {
      setNote(`${W.failed} ${failure instanceof Error ? failure.message : 'the app could not be reached.'}`);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { state, note, busy, set };
}

type Props = { t: SeThemeTokens; refreshKey?: string; onChanged?: () => void };

export function MatchingToggle({ t, refreshKey, onChanged }: Props) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { state, note, busy, set } = useMatching(refreshKey);
  if (!state || !seMatchingToggleShown(state)) return null;
  const change = async (enabled: boolean) => {
    if (await set(enabled)) onChanged?.();
  };
  return (
    <View style={s.card} accessibilityLabel={W.title}>
      <View style={s.row}>
        <Text style={s.toggleText}>{W.toggle}</Text>
        <Switch
          accessibilityLabel={W.toggle}
          value={state.enabled}
          disabled={busy}
          onValueChange={(value) => void change(value)}
          trackColor={{ false: t.hair, true: t.btn }}
        />
      </View>
      <Text style={s.hint}>{W.hint}</Text>
      {note ? (
        <Text accessibilityRole="alert" style={s.hint}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 8, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    toggleText: { flex: 1, fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
    hint: { fontSize: 14, lineHeight: 20, color: t.soft, fontFamily: SE_FONT.sans },
  });
}
