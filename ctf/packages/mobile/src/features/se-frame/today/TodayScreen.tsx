// Today in 3.1 on Android, the copy of the web's today-screen.tsx: the broadcast while it is live,
// Days won, the rooms, then the day's cards newest first. There is no done count, as on the web.

import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  SE_DAYS_WON_HOW,
  SE_DAYS_WON_TITLE,
  SE_DAYS_WON_WHY,
  SE_MUTE_WORDS,
  seCardMutedNote,
  seCardMuteRequest,
  type SeCardMuteKind,
  SE_TODAY_FILTERS,
  seDaysWonLines,
  seTodayView,
  type SeThemeTokens,
  type SeToday,
  type SeTodayCard,
  type SeTodayFilter,
} from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import type { FeatureKey } from '../../../navigation/screens';
import { SE_FONT } from '../fonts';
import { MatchingToggle } from './MatchingToggle';
import { BroadcastCard, RoomCard } from './RoomCards';
import { WeekStrip } from './WeekStrip';
import { TodayCard } from './TodayCard';
import { sendTodayFeedback } from './sendFeedback';
import { openTodayLink } from './openTodayLink';
import { useToday } from './useToday';
import { useEmojiRainTrigger } from './EmojiRain';

type Styles = ReturnType<typeof makeStyles>;

// "How it's counted" opens the definition in place, under the line.
function DaysWonCard({ s, daysWon }: { s: Styles; daysWon: NonNullable<SeToday['daysWon']> }) {
  const lines = seDaysWonLines(daysWon);
  const [how, setHow] = useState(false);
  return (
    <View style={s.daysWon} accessibilityLabel={SE_DAYS_WON_TITLE}>
      <Text style={s.daysWonLabel}>{SE_DAYS_WON_TITLE.toUpperCase()}</Text>
      <Text style={s.daysWonBig}>{lines.big}</Text>
      <Text style={s.daysWonSmall}>{lines.small}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: how }} onPress={() => setHow((value) => !value)} style={s.how}>
        <Text style={s.howLabel}>{SE_DAYS_WON_HOW}</Text>
      </TouchableOpacity>
      {how ? <Text style={s.daysWonSmall}>{lines.how}</Text> : null}
      {how ? (
        <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL(SE_DAYS_WON_WHY.href)} style={s.how}>
          <Text style={s.howLabel}>{SE_DAYS_WON_WHY.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type LiveProps = { t: SeThemeTokens; s: Styles; today: SeToday | null; go: (_href: string) => void };

function LiveCards({ t, s, today, go }: LiveProps) {
  const broadcast = today?.broadcast;
  return (
    <>
      {today?.daysWon ? <DaysWonCard s={s} daysWon={today.daysWon} /> : null}
      {today ? <WeekStrip t={t} talks={today.week ?? []} /> : null}
      {broadcast?.live ? <BroadcastCard t={t} broadcast={broadcast} go={go} /> : null}
      {today?.rooms.map((room) => <RoomCard key={room.key} t={t} room={room} broadcasting={broadcast?.live === true} />)}
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

// A visitor who is not signed in gets GuestToday (GuestToday.tsx) instead.
// `onPresence` hands the "N Avens here" count to the title row above the screen. `rain` carries the
// emoji rain switch, the Days won total the account last saw (useSePrefs.ts) and how to start the rain,
// which the frame draws over the screen.
type RainPrefs = { on: boolean; seen: number | null | undefined; onSeen: (_total: number) => void; onRain: () => void };
type ScreenProps = { t: SeThemeTokens; accountId: string; onOpen: (_key: FeatureKey) => void; onPresence?: (_count: number | null) => void; rain: RainPrefs };

export function TodayScreen({ t, accountId, onOpen, onPresence, rain }: ScreenProps) {
  const s = makeStyles(t);
  const { today, loading, error, marks, mark, toggle, markRead, save, saveNote, reload } = useToday(accountId);
  useEmojiRainTrigger({ ...rain, daysWon: today?.daysWon });
  const presence = today?.presence ?? null;
  useEffect(() => onPresence?.(presence), [onPresence, presence]);
  const [filter, setFilter] = useState<SeTodayFilter>('all');
  const go = (href: string) => openTodayLink(href, onOpen);
  const view = seTodayView(today, marks, filter);
  const [muteNote, setMuteNote] = useState<string | null>(null);

  // Mute the card's author (their cards leave Today) or the card itself (it leaves Today and its
  // conversation sends no notices), from the next read. Nobody is told.
  const mute = async (card: SeTodayCard, kind: SeCardMuteKind) => {
    const body = seCardMuteRequest(card, kind);
    if (!body) return;
    try {
      await authedFetchJson('/api/account/mutes', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(body),
      });
      setMuteNote(seCardMutedNote(card, kind));
      if (kind === 'person') mark('hidden', card.id);
      void reload();
    } catch (error) {
      setMuteNote(`${SE_MUTE_WORDS.failed} ${error instanceof Error ? error.message : ''}`.trim());
    }
  };

  return (
    <>
      <LiveCards t={t} s={s} today={today} go={go} />
      <View style={s.listHead}>
        <Text accessibilityRole="header" style={s.listTitle}>
          Today&apos;s cards
        </Text>
      </View>
      <FilterChips s={s} filter={filter} onChange={setFilter} />
      {filter === 'matches' ? <MatchingToggle t={t} refreshKey={today?.generatedAtIso} onChanged={() => void reload()} /> : null}
      <Notices s={s} error={error} missingLine={view.missingLine} loading={!today && loading} onRetry={() => void reload()} />
      {saveNote ? (
        <Text accessibilityRole="alert" style={s.meta}>
          {saveNote}
        </Text>
      ) : null}
      {muteNote ? <Text style={s.meta}>{muteNote}</Text> : null}
      {today ? (
        <View style={s.timeline}>
          <View style={s.line} />
          {view.cards.map((card) => (
            <TodayCard
              key={card.id}
              t={t}
              card={card}
              viewerId={accountId}
              read={marks.read.includes(card.id)}
              onToggleDone={() => {
                if (!marks.read.includes(card.id)) sendTodayFeedback(card, 'done');
                toggle('read', card.id);
              }}
              onHide={() => {
                sendTodayFeedback(card, 'not_for_me');
                mark('hidden', card.id);
              }}
              onMute={card.author ? () => void mute(card, 'person') : undefined}
              onMutePost={() => void mute(card, 'post')}
              onSave={() => save(card)}
              onOpenLink={go}
              onChanged={() => void reload()}
              onRead={() => markRead(card.id)}
            />
          ))}
          <View style={s.caughtUp}>
            <Text style={s.caughtUpTitle}>{view.caughtUpLine}</Text>
            <Text style={s.meta}>{view.caughtUpNote}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    daysWon: { gap: 6, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 18, borderRadius: 22, backgroundColor: t.hero, boxShadow: `0px 4px 0px ${t.line}` },
    daysWonLabel: { fontSize: 12, letterSpacing: 1.4, opacity: 0.85, color: t.onHero, fontFamily: SE_FONT.sansBold },
    daysWonBig: { fontSize: 76, lineHeight: 80, color: t.pick, fontFamily: SE_FONT.serif },
    daysWonSmall: { fontSize: 15, lineHeight: 21, color: t.onHero, fontFamily: SE_FONT.sans },
    how: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
    howLabel: { fontSize: 13, opacity: 0.9, color: t.onHero, textDecorationLine: 'underline', fontFamily: SE_FONT.sans },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
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
