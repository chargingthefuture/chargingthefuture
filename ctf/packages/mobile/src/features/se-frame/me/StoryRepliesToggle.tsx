// Settings → Safety and privacy on Android, the copy of the web's story-replies-toggle.tsx: whether
// visitors without an account may read what the member writes in the conversation on members'
// stories (owner decision, 2026-11-16). Off until the member turns it on; off again hides their
// replies from visitors at once. Approved members only: for anybody else nothing is drawn.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SE_STORY_REPLIES_VISITORS_WORDS as W, type SeStoryRepliesVisitorsState, type SeThemeTokens } from '@ctf/shared';
import { authedFetch, authedFetchJson } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';
import { SE_FONT } from '../fonts';

const URL = '/api/today/story-replies/visitors';

function useStoryReplies() {
  const [state, setState] = useState<SeStoryRepliesVisitorsState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A member who is not approved yet gets 401 or 403: no toggle, nothing to report. Any other failure
  // also hides the toggle, and is reported so it is not lost.
  const load = useCallback(async () => {
    try {
      const res = await authedFetch(URL);
      if (res.status === 401 || res.status === 403) return setState(null);
      const data = (await res.json().catch(() => null)) as (SeStoryRepliesVisitorsState & { message?: string }) | null;
      if (!res.ok || !data) throw new Error(data?.message ?? `The setting could not be read (HTTP ${res.status}).`);
      setState({ agreed: data.agreed === true });
    } catch (failure) {
      reportError(failure, { area: 'today', op: 'story_replies_visitors_read' });
      setState(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const set = async (agreed: boolean) => {
    setBusy(true);
    try {
      const data = await authedFetchJson<SeStoryRepliesVisitorsState>(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ agreed }),
      });
      setNote(null);
      setState({ agreed: data.agreed === true });
    } catch (failure) {
      setNote(`${W.failed} ${failure instanceof Error ? failure.message : 'the app could not be reached.'}`);
    } finally {
      setBusy(false);
    }
  };
  return { state, note, busy, set };
}

export function StoryRepliesToggle({ t }: { t: SeThemeTokens }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { state, note, busy, set } = useStoryReplies();
  if (!state) return null;
  return (
    <View style={s.card} accessibilityLabel={W.title}>
      <View style={s.row}>
        <Text style={s.toggleText}>{W.toggle}</Text>
        <Switch
          accessibilityLabel={W.toggle}
          value={state.agreed}
          disabled={busy}
          onValueChange={(value) => void set(value)}
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
