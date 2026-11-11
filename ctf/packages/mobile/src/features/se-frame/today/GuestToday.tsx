// Today for a visitor who is not signed in, the Android copy of the web's guest-today.tsx, built to
// the approved "Today, signed out" board: Days won with what Skills Economy is and Sign up, the Main
// Room with Listen as a guest in place (or, on a quiet day, the readings and the next room), the
// day's cards read only, asks and offers from "A member" with Sign up to answer, and People locked.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  SE_DAYS_WON_TITLE,
  SE_DAYS_WON_WHY,
  SE_GUEST_WORDS as W,
  seDaysWonLines,
  seGuestAnswersBySignUp,
  seGuestOpensSheet,
  seGuestNextRoomLine,
  seGuestStartedLine,
  seTalkCalendarEvent,
  seTodayView,
  type SeThemeTokens,
  type SeToday,
  type SeTodayCard,
  type SeTodayTalk,
} from '@ctf/shared';
import { AddToCalendarButton } from '../../../components/shared/AddToCalendarButton';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { ChymeGuestListen, GuestNote } from '../../chyme/chyme-guest-listen';
import { ChymeReadingsPlayer } from '../../chyme/chyme-readings-player';
import { getPublicRoom, type LiveState } from '../../chyme/chyme-public-api';
import { ChymeTokensContext, seChymeTokens } from '../../chyme/chyme-tokens';
import type { FeatureKey } from '../../../navigation/screens';
import { SE_FONT } from '../fonts';
import { openTodayLink } from './openTodayLink';
import { useToday } from './useToday';
import { GuestSheet } from './GuestSheet';
import Svg, { Path, Rect } from 'react-native-svg';

type Styles = ReturnType<typeof makeStyles>;

// The small tag on sample data: a lock and "Sample", so a visitor reads it as private rather than
// empty, as on the web.
function SampleTag({ s, color }: { s: Styles; color: string }) {
  return (
    <View style={[s.sampleTag, { borderColor: color }]} accessible accessibilityLabel={W.sampleLabel}>
      <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3} y={11} width={18} height={11} rx={2} />
        <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </Svg>
      <Text style={[s.sampleTagText, { color }]}>{W.sample}</Text>
    </View>
  );
}

function Hero({ s, t, today, onSignUp }: { s: Styles; t: SeThemeTokens; today: SeToday | null; onSignUp: () => void }) {
  const big = today?.daysWon ? seDaysWonLines(today.daysWon).big : null;
  return (
    <View style={s.hero} accessibilityLabel={SE_DAYS_WON_TITLE}>
      <View style={s.row}>
        <Text style={s.heroLabel}>{SE_DAYS_WON_TITLE}</Text>
        {big && today?.daysWon?.sample ? <SampleTag s={s} color={t.onHero} /> : null}
      </View>
      {big ? <Text style={s.heroBig}>{big}</Text> : null}
      <Text style={s.heroText}>{W.hero}</Text>
      <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL(SE_DAYS_WON_WHY.href)} style={s.heroWhy}>
        <Text style={s.heroWhyLabel}>{SE_DAYS_WON_WHY.label}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={onSignUp} style={s.heroButton}>
        <Text style={s.heroButtonLabel}>{W.signUp}</Text>
      </TouchableOpacity>
    </View>
  );
}

function useGuestRoom() {
  const [room, setRoom] = useState<LiveState | null>(null);
  const load = useCallback(async () => setRoom(await getPublicRoom()), []);
  useEffect(() => void load(), [load]);
  return { room, reload: load };
}

function LiveRoom({ s, t, talk, room, onGone }: { s: Styles; t: SeThemeTokens; talk: SeTodayTalk | null; room: LiveState; onGone: () => void }) {
  const [listening, setListening] = useState(false);
  return (
    <View style={s.roomCard} accessibilityLabel="Live room">
      <View style={s.row}>
        <Text style={s.liveBadge}>{W.live}</Text>
        {talk?.onAir ? <Text style={s.meta}>{seGuestStartedLine(talk.startIso)}</Text> : null}
      </View>
      <Text style={s.roomTitle}>{talk?.onAir ? talk.title : 'Main Room'}</Text>
      {listening ? (
        room.guestListenAllowed ? (
          <ChymeGuestListen participantCount={room.participantCount} guestCount={room.guestCount} accent={t.btn} onRoomGone={onGone} onListeningChange={() => undefined} leaveKey={0} />
        ) : (
          <GuestNote accent={t.btn} text={W.listenUnavailable} detail={room.listenUnavailable ?? 'The server sent no reason.'} />
        )
      ) : (
        <>
          <Text style={s.meta}>{W.listenNote}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setListening(true)} style={s.primary}>
            <Text style={s.primaryLabel}>{W.listen}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function QuietRoom({ s, t, talk, onLive }: { s: Styles; t: SeThemeTokens; talk: SeTodayTalk | null; onLive: () => void }) {
  return (
    <View style={s.roomCard} accessibilityLabel="Rooms">
      <Text style={s.roomTitle}>{W.quiet}</Text>
      <ChymeReadingsPlayer onRoomLive={onLive} />
      {talk && !talk.onAir ? (
        <View style={s.nextRoom}>
          <Text style={s.meta}>{W.nextRoom}</Text>
          <Text style={s.nextRoomWhen}>{seGuestNextRoomLine(talk.startIso)}</Text>
          <AddToCalendarButton color={t.ink} borderColor={t.line} event={seTalkCalendarEvent(talk)} />
        </View>
      ) : null}
    </View>
  );
}

function RoomCard({ s, t, today }: { s: Styles; t: SeThemeTokens; today: SeToday | null }) {
  const { room, reload } = useGuestRoom();
  const talk = today?.rooms[0]?.nextTalk ?? null;
  const tokens = useMemo(() => seChymeTokens(t), [t]);
  if (!room) return null;
  let body: React.ReactNode;
  if (room.checkFailed) {
    body = (
      <View style={s.roomCard}>
        <Text style={s.meta}>{room.checkFailed}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} style={s.action}>
          <Text style={s.actionLabel}>{W.tryAgain}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (room.isLive) {
    body = <LiveRoom s={s} t={t} talk={talk} room={room} onGone={() => void reload()} />;
  } else {
    body = <QuietRoom s={s} t={t} talk={talk} onLive={() => void reload()} />;
  }
  return <ChymeTokensContext.Provider value={tokens}>{body}</ChymeTokensContext.Provider>;
}

function GuestCard({ s, t, card, onSignUp, go }: { s: Styles; t: SeThemeTokens; card: SeTodayCard; onSignUp: () => void; go: (_href: string) => void }) {
  const [open, setOpen] = useState(false);
  const color = t.kind[card.kind];
  const bySignUp = seGuestAnswersBySignUp(card);
  return (
    <View style={s.card}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <View style={s.row}>
        {bySignUp ? <SeAvatar accountId={card.id} size={28} /> : null}
        {bySignUp ? <Text style={s.handle}>{W.member}</Text> : null}
        <Text style={[s.label, { color }]}>{card.label}</Text>
        {card.sample ? <SampleTag s={s} color={t.ink} /> : null}
      </View>
      <Text style={s.title}>{card.title}</Text>
      {card.body && !bySignUp ? (
        <Text style={s.body} numberOfLines={3}>
          {card.body}
        </Text>
      ) : null}
      <View style={s.row}>
        {bySignUp ? (
          <TouchableOpacity accessibilityRole="button" onPress={onSignUp} style={s.action}>
            <Text style={s.actionLabel}>{W.answer}</Text>
          </TouchableOpacity>
        ) : (
          card.actions.map((item) => (
            <TouchableOpacity key={item.kind + item.label} accessibilityRole="link" onPress={() => go(item.href)} style={s.action}>
              <Text style={s.actionLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))
        )}
        {seGuestOpensSheet(card) ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(true)} style={s.action}>
            <Text style={s.actionLabel}>{W.conversation}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {open ? <GuestSheet t={t} card={card} sampleTag={<SampleTag s={s} color={t.ink} />} onSignIn={onSignUp} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}

export function GuestToday({ t, onSignUp, onOpen }: { t: SeThemeTokens; onSignUp: () => void; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { today, loading, error, marks, reload } = useToday(null);
  const view = seTodayView(today, marks, 'all');
  const go = (href: string) => openTodayLink(href, onOpen);
  return (
    <>
      <Hero s={s} t={t} today={today} onSignUp={onSignUp} />
      <RoomCard s={s} t={t} today={today} />
      <View style={s.listHead}>
        <Text style={s.listTitle}>{W.cardsTitle}</Text>
      </View>
      {error ? (
        <View style={s.notice} accessibilityRole="alert">
          <Text style={s.noticeText}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void reload()} style={s.action}>
            <Text style={s.actionLabel}>{W.tryAgain}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!today && loading ? <Text style={s.meta}>{W.loading}</Text> : null}
      <View style={s.timeline}>
        <View style={s.line} />
        {view.cards.map((card) => (
          <GuestCard key={card.id} s={s} t={t} card={card} onSignUp={onSignUp} go={go} />
        ))}
        <View style={[s.card, s.locked]}>
          <View style={[s.dot, { backgroundColor: t.kind.match }]} />
          <Text style={s.title}>{W.peopleTitle}</Text>
          <Text style={s.body}>{W.peopleLocked}</Text>
        </View>
      </View>
      <Text style={s.sampleNote}>{W.sampleNote}</Text>
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    hero: { gap: 2, padding: 16, borderRadius: 20, backgroundColor: t.hero },
    heroLabel: { fontSize: 13, color: t.onHero, fontFamily: SE_FONT.sansBold },
    heroBig: { fontSize: 40, lineHeight: 44, color: t.onHero, fontFamily: SE_FONT.serif },
    heroText: { fontSize: 14, lineHeight: 20, color: t.onHero, fontFamily: SE_FONT.sans },
    heroWhy: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
    heroWhyLabel: { fontSize: 13, opacity: 0.9, color: t.onHero, textDecorationLine: 'underline', fontFamily: SE_FONT.sans },
    heroButton: { alignSelf: 'flex-start', marginTop: 6, minHeight: 46, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 999, backgroundColor: t.onHero, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    heroButtonLabel: { fontSize: 15, color: t.hero, fontFamily: SE_FONT.sansBold },
    roomCard: { gap: 10, padding: 16, borderRadius: 20, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    liveBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: t.liveBadge, color: t.onLiveBadge, fontSize: 11, letterSpacing: 1.1, fontFamily: SE_FONT.sansBold },
    roomTitle: { fontSize: 21, lineHeight: 25, color: t.ink, fontFamily: SE_FONT.serif },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    nextRoom: { gap: 4 },
    nextRoomWhen: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansSemi },
    primary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, boxShadow: `0px 3px 0px ${t.line}` },
    primaryLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    listTitle: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    notice: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    noticeText: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    timeline: { gap: 14, paddingLeft: 40 },
    line: { position: 'absolute', left: 13, top: 8, bottom: 8, width: 2, backgroundColor: t.hair },
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    locked: { gap: 6, backgroundColor: t.sunk, borderStyle: 'dashed', borderColor: t.soft },
    dot: { position: 'absolute', left: -40, top: 12, width: 28, height: 28, borderRadius: 14 },
    handle: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    label: { fontSize: 12, fontFamily: SE_FONT.sansBold, flexShrink: 1 },
    title: { fontSize: 17, lineHeight: 22, color: t.ink, fontFamily: SE_FONT.sansBold },
    body: { fontSize: 14, lineHeight: 20, color: t.soft, fontFamily: SE_FONT.sans },
    action: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    actionLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    // The small tag on sample data, and the one line under the cards that says why.
    sampleTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, borderRadius: 999, borderWidth: 1, opacity: 0.7 },
    sampleTagText: { fontSize: 10, lineHeight: 16, fontFamily: SE_FONT.sansSemi },
    sampleNote: { marginTop: 4, fontSize: 12, color: t.soft, textAlign: 'center', fontFamily: SE_FONT.sans },
  });
}
