// Activity on Android, the copy of the web (web components/se-frame/activity/): what needs the
// member's answer, then what happened, from the app's notifications. Opening an item marks it read.
// No red badges: "New" uses the theme's own colors.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_ACTIVITY_WORDS as W, seActivityView, seAgo, type SeActivityItem, type SeThemeTokens } from '@ctf/shared';
import { authedFetch, authedFetchJson } from '../../../auth/authedFetch';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import { SE_FONT } from '../fonts';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; items: SeActivityItem[] };
type Styles = ReturnType<typeof makeStyles>;

const CSRF = { 'x-ctf-csrf': '1' };

function useActivity() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const body = await authedFetchJson<{ notifications?: SeActivityItem[] }>('/api/notifications');
      setState({ kind: 'ready', items: body.notifications ?? [] });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const markRead = useCallback((id: string) => {
    setState((current) =>
      current.kind === 'ready' ? { kind: 'ready', items: current.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)) } : current,
    );
    void authedFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: CSRF }).catch(() => undefined);
  }, []);
  const markAllRead = useCallback(() => {
    setState((current) => (current.kind === 'ready' ? { kind: 'ready', items: current.items.map((item) => ({ ...item, isRead: true })) } : current));
    void authedFetch('/api/notifications/read-all', { method: 'POST', headers: CSRF }).catch(() => undefined);
  }, []);
  return { state, reload: load, markRead, markAllRead };
}

function Group({ s, title, items, onOpen }: { s: Styles; title: string; items: SeActivityItem[]; onOpen: (_item: SeActivityItem) => void }) {
  if (items.length === 0) return null;
  return (
    <View style={s.group} accessibilityLabel={title}>
      <Text accessibilityRole="header" style={s.groupTitle}>
        {title}
      </Text>
      {items.map((item) => (
        <TouchableOpacity key={item.id} accessibilityRole={item.linkPath ? 'link' : 'button'} onPress={() => onOpen(item)} style={s.row}>
          <Text style={s.summary}>{item.summary}</Text>
          <View style={s.meta}>
            {item.isRead ? null : <Text style={s.isNew}>{W.isNew}</Text>}
            <Text style={s.when}>{seAgo(item.createdAtIso)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ActivityScreen({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { state, reload, markRead, markAllRead } = useActivity();
  if (state.kind === 'loading') return <Text style={s.text}>{W.loading}</Text>;
  if (state.kind === 'error') {
    return (
      <Text accessibilityRole="alert" style={s.text}>
        {W.failed} {state.message}{' '}
        <Text accessibilityRole="button" onPress={() => void reload()} style={s.link}>
          {W.tryAgain}
        </Text>
      </Text>
    );
  }
  if (state.items.length === 0) return <Text style={s.text}>{W.empty}</Text>;
  const view = seActivityView(state.items);
  const open = (item: SeActivityItem) => {
    markRead(item.id);
    if (item.linkPath) openTodayLink(item.linkPath, onOpen);
  };
  return (
    <>
      <Group s={s} title={W.answer} items={view.answer} onOpen={open} />
      <Group s={s} title={W.happened} items={view.happened} onOpen={open} />
      {state.items.some((item) => !item.isRead) ? (
        <TouchableOpacity accessibilityRole="button" onPress={markAllRead} style={s.allRead}>
          <Text style={s.allReadLabel}>{W.allRead}</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    group: { gap: 8 },
    groupTitle: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansBold },
    row: { gap: 4, minHeight: 44, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card },
    summary: { fontSize: 15, lineHeight: 21, color: t.ink, fontFamily: SE_FONT.sans },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    isNew: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: t.btn, color: t.onBtn, fontSize: 11, fontFamily: SE_FONT.sansBold },
    when: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    link: { color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
    allRead: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
      boxShadow: `0px 2px 0px ${t.line}`,
    },
    allReadLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}
