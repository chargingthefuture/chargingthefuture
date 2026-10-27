// Today in 3.1 on Android, the copy of the web's today-screen.tsx: the broadcast while it is live,
// the Main Room, then the day's cards newest first. The done count stays hidden until the member
// has opened a card.

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_TODAY_FILTERS, seRoomPeopleLine, seTodayView, type SeThemeTokens, type SeToday, type SeTodayFilter, type SeTodayRoom } from '@ctf/shared';
import type { FeatureKey } from '../../../navigation/screens';
import { SE_FONT } from '../fonts';
import { TodayCard } from './TodayCard';
import { openTodayLink } from './openTodayLink';
import { useToday } from './useToday';

function RoomCard({ t, room, onOpen }: { t: SeThemeTokens; room: SeTodayRoom; onOpen: () => void }) {
  const s = makeStyles(t);
  return (
    <View style={s.roomCard} accessibilityLabel={room.name}>
      <View style={s.row}>
        {room.live ? <Text style={s.liveBadge}>LIVE</Text> : null}
        <Text style={s.roomName}>{room.name}</Text>
        <Text style={s.meta}>· open to everyone</Text>
      </View>
      <Text style={s.meta}>{seRoomPeopleLine(room.members, room.guests)}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onOpen} style={s.primary}>
        <Text style={s.primaryLabel}>{room.live ? 'Listen in' : 'Open the room'}</Text>
      </TouchableOpacity>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function LiveCards({ t, s, today, go }: { t: SeThemeTokens; s: Styles; today: SeToday | null; go: (_href: string) => void }) {
  const broadcast = today?.broadcast;
  return (
    <>
      {broadcast?.live ? (
        <View style={s.roomCard} accessibilityLabel="Live broadcast">
          <View style={s.row}>
            <Text style={s.liveBadge}>LIVE</Text>
            <Text style={s.roomName}>Broadcast</Text>
          </View>
          {broadcast.title ? <Text style={s.roomTitle}>{broadcast.title}</Text> : null}
          <TouchableOpacity accessibilityRole="button" onPress={() => go(broadcast.href)} style={s.primary}>
            <Text style={s.primaryLabel}>Watch now</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {today?.rooms.map((room) => <RoomCard key={room.key} t={t} room={room} onOpen={() => go(room.href)} />)}
    </>
  );
}

function FilterChips({ s, filter, onChange }: { s: Styles; filter: SeTodayFilter; onChange: (_next: SeTodayFilter) => void }) {
  return (
    <View style={s.chips}>
      {SE_TODAY_FILTERS.map((item) => {
        const on = filter === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(item.key)}
            style={[s.chip, on ? s.chipOn : null]}
          >
            <Text style={[s.chipLabel, on ? s.chipLabelOn : null]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Notices({ s, error, missingLine, loading, onRetry }: { s: Styles; error: string | null; missingLine: string | null; loading: boolean; onRetry: () => void }) {
  return (
    <>
      {error ? (
        <View style={s.notice} accessibilityRole="alert">
          <Text style={s.noticeText}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={s.action}>
            <Text style={s.actionLabel}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {missingLine ? <Text style={s.meta}>{missingLine}</Text> : null}
      {loading ? <Text style={s.meta}>Loading Today…</Text> : null}
    </>
  );
}

export function TodayScreen({ t, accountId, onOpen }: { t: SeThemeTokens; accountId: string; onOpen: (_key: FeatureKey) => void }) {
  const s = makeStyles(t);
  const { today, loading, error, marks, mark, reload } = useToday(accountId);
  const [filter, setFilter] = useState<SeTodayFilter>('all');
  const go = (href: string) => openTodayLink(href, onOpen);
  const view = seTodayView(today, marks, filter);

  return (
    <>
      <LiveCards t={t} s={s} today={today} go={go} />
      <View style={s.listHead}>
        <Text accessibilityRole="header" style={s.listTitle}>
          Today&apos;s cards
        </Text>
        {view.doneLine ? <Text style={s.meta}>{view.doneLine}</Text> : null}
      </View>
      <FilterChips s={s} filter={filter} onChange={setFilter} />
      <Notices s={s} error={error} missingLine={view.missingLine} loading={!today && loading} onRetry={() => void reload()} />
      {today ? (
        <View style={s.timeline}>
          <View style={s.line} />
          {view.cards.map((card) => (
            <TodayCard
              key={card.id}
              t={t}
              card={card}
              read={marks.read.includes(card.id)}
              onRead={() => mark('read', card.id)}
              onHide={() => mark('hidden', card.id)}
              onOpenLink={go}
            />
          ))}
          <View style={s.caughtUp}>
            <Text style={s.caughtUpTitle}>{view.caughtUpLine}</Text>
            <Text style={s.meta}>New cards arrive as people post.</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    roomCard: { gap: 10, padding: 16, borderRadius: 20, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    liveBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: t.liveBadge, color: t.onLiveBadge, fontSize: 11, letterSpacing: 1.1, fontFamily: SE_FONT.sansBold },
    roomName: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    roomTitle: { fontSize: 21, lineHeight: 25, color: t.ink, fontFamily: SE_FONT.serif },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    primary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, boxShadow: `0px 3px 0px ${t.line}` },
    primaryLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    listTitle: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.hair },
    chipOn: { backgroundColor: t.ink, borderColor: t.ink },
    chipLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    chipLabelOn: { color: t.bg },
    notice: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    noticeText: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    action: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    actionLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    timeline: { gap: 14, paddingLeft: 40 },
    line: { position: 'absolute', left: 13, top: 8, bottom: 8, width: 2, backgroundColor: t.hair },
    caughtUp: { alignItems: 'center', gap: 4, marginLeft: -40, paddingTop: 18 },
    caughtUpTitle: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
  });
}
