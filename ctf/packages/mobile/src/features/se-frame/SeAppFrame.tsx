// The 3.1 app frame, the Android copy of the web (components/se-frame/se-app-frame.tsx): one screen
// per tab, the open room and its bar, and the tab bar along the bottom.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SE_AVENHOOD,
  SE_AVENHOOD_DEFINITION,
  SE_TEXT_SIZE_SCALE,
  sePresenceLine,
  seReadableTokens,
  seTheme,
  type SeNewKind,
  type SeTab,
  type SeThemeTokens,
} from '@ctf/shared';
import { useAuth } from '../../auth/auth-context';
import { SeTabBar } from './SeTabBar';
import { SE_FONT, setSeReadableFont } from './fonts';
import { useInterfaceVersion } from './interface-version';
import { TodayScreen } from './today/TodayScreen';
import { MeTab } from './me/MeTab';
import { useSePrefs, type SePrefs } from './useSePrefs';
import { ScaledScreen } from './ScaledScreen';
import { UnlockBanner } from './UnlockBanner';
import { SeFrameScrollContext } from './frame-scroll';
import { NewScreen } from './new/NewScreen';
import { ActivityScreen } from './activity/ActivityScreen';
import { PeopleScreen } from './people/PeopleScreen';
import { SeRoomBar, SeRoomHosts } from './rooms/SeRoomScreen';
import { SeRoomsProvider, useSeRooms } from './rooms/SeRooms';
import type { FeatureKey } from '../../navigation/screens';

const TODAY_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// + New has no title here: it is a sheet with its own heading, as on the web.
const TITLES: Record<Exclude<SeTab, 'new' | 'people'>, string> = {
  today: `Today in the ${SE_AVENHOOD}`,
  activity: 'Activity',
  me: 'Me',
};

type FrameProps = { onOpen: (_key: FeatureKey) => void };

export function SeAppFrame(props: FrameProps) {
  return (
    <SeRoomsProvider>
      <SeAppFrameBody {...props} />
    </SeRoomsProvider>
  );
}

// The phone's back button closes an open room first, then returns to Today from any other tab.
function useFrameBack(tab: SeTab, setTab: (_tab: SeTab) => void, roomShown: boolean, minimize: () => void) {
  useEffect(() => {
    if (tab === 'today' && !roomShown) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (roomShown) minimize();
      else setTab('today');
      return true;
    });
    return () => sub.remove();
  }, [tab, setTab, roomShown, minimize]);
}

function SeAppFrameBody({ onOpen }: FrameProps) {
  const prefs = useSePrefs();
  const { theme, reading } = prefs;
  // The easier-to-read font is set before anything is drawn; a fresh tokens object makes every
  // screen build its styles again when the font or contrast changes.
  setSeReadableFont(reading.readableFont);
  const t = useMemo(
    () => ({ ...seReadableTokens(seTheme(theme.color, theme.mode), reading.highContrast) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readableFont changes the fonts the screens read through SE_FONT.
    [theme.color, theme.mode, reading.highContrast, reading.readableFont],
  );
  const s = useMemo(() => makeStyles(t), [t]);
  const { user } = useAuth();
  const { switchTo, saving, error } = useInterfaceVersion();
  const [tab, setTab] = useState<SeTab>('today');
  const [newKind, setNewKind] = useState<SeNewKind>('ask');
  const [presence, setPresence] = useState<number | null>(null);
  const rooms = useSeRooms();
  const { minimize } = rooms;
  useFrameBack(tab, setTab, rooms.shown !== null, minimize);

  // Choosing a tab while a room is open puts the room in the bar above the tab bar.
  const select = useCallback(
    (next: SeTab) => {
      minimize();
      setNewKind('ask');
      setTab(next);
    },
    [minimize],
  );
  const back = () => void switchTo('3.0');
  // Settings → Ask the architect opens + New on its architect sheet.
  const askArchitect = () => {
    select('new');
    setNewKind('architect');
  };
  const scrollRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []);

  return (
    <View style={s.frame}>
      <SeFrameScrollContext.Provider value={scrollToTop}>
      <ScrollView ref={scrollRef} style={rooms.shown ? s.hidden : null}>
        <ScaledScreen scale={SE_TEXT_SIZE_SCALE[reading.textSize]} style={s.screen}>
          <UnlockBanner t={t} onOpenUnlock={() => onOpen('unlock')} />
          <FrameHeader s={s} tab={tab} presence={presence} />

          <TabScreen
            t={t}
            tab={tab}
            user={user}
            prefs={prefs}
            newKind={newKind}
            onAskArchitect={askArchitect}
            onBack={back}
            onClose={() => select('today')}
            saving={saving}
            onOpen={onOpen}
            onPresence={setPresence}
          />

          {[error, prefs.error].filter(Boolean).map((message) => (
            <Text key={message} accessibilityRole="alert" style={s.error}>
              {message}
            </Text>
          ))}
        </ScaledScreen>
      </ScrollView>
      </SeFrameScrollContext.Provider>
      {user ? <SeRoomHosts t={t} user={{ userId: user.id, username: user.username ?? null }} /> : null}
      <SeRoomBar t={t} />
      <SeTabBar t={t} active={tab} onSelect={select} />
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

type TabScreenProps = {
  t: SeThemeTokens;
  tab: SeTab;
  onPresence: (_count: number | null) => void;
  user: { id: string; username?: string | null; isAdmin?: boolean } | null;
  prefs: SePrefs;
  newKind: SeNewKind;
  onAskArchitect: () => void;
  onBack: () => void;
  onClose: () => void;
  saving: boolean;
  onOpen: (_key: FeatureKey) => void;
};

function TabScreen({ t, tab, onPresence, user, prefs, newKind, onAskArchitect, onBack, onClose, saving, onOpen }: TabScreenProps) {
  if (tab === 'me') {
    return user ? <MeTab t={t} user={user} prefs={prefs} onAskArchitect={onAskArchitect} onBack={onBack} saving={saving} onOpen={onOpen} /> : null;
  }
  if (tab === 'today') return user ? <TodayScreen t={t} accountId={user.id} onOpen={onOpen} onPresence={onPresence} /> : null;
  if (tab === 'new') return <NewScreen key={newKind} t={t} initialKind={newKind} onOpen={onOpen} onClose={onClose} />;
  if (tab === 'activity') return <ActivityScreen t={t} onOpen={onOpen} />;
  return <PeopleScreen t={t} onOpen={onOpen} onToday={onClose} />;
}

// Today's title row carries how many members are here ("3 Avens here"), hidden while unknown.
function FrameHeader({ s, tab, presence }: { s: Styles; tab: SeTab; presence: number | null }) {
  const [definitionOpen, setDefinitionOpen] = useState(false);
  // Me has no title, as on the web: the member's own picture and handle head it. + New is a sheet
  // with its own heading. People heads itself, with the number listed beside its title.
  if (tab === 'me' || tab === 'new' || tab === 'people') return null;
  if (tab !== 'today') {
    return (
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.title}>
          {TITLES[tab]}
        </Text>
      </View>
    );
  }
  const here = sePresenceLine(presence);
  return (
    <View style={s.header}>
      <View style={s.todayRow}>
        <View style={s.todayText}>
          <Text style={s.eyebrow}>{TODAY_DATE.format(new Date())}</Text>
          <Text accessibilityRole="header" style={s.title}>
            Today in the{' '}
            <Text
              accessibilityRole="button"
              accessibilityState={{ expanded: definitionOpen }}
              onPress={() => setDefinitionOpen((value) => !value)}
              style={s.term}
            >
              {SE_AVENHOOD}
            </Text>
          </Text>
        </View>
        {here ? (
          <View style={s.presence}>
            <View style={s.presenceDot} />
            <Text style={s.presenceLabel}>{here}</Text>
          </View>
        ) : null}
      </View>
      {definitionOpen ? <Text style={s.definition}>{SE_AVENHOOD_DEFINITION}</Text> : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    frame: { flex: 1, backgroundColor: t.bg },
    hidden: { display: 'none' },
    // Room for the tab bar, and the room bar above it while the member is in a call.
    screen: { gap: 18, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 180 },
    header: { gap: 2 },
    eyebrow: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    title: { fontSize: 30, lineHeight: 33, color: t.ink, fontFamily: SE_FONT.serif },
    todayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 },
    todayText: { flex: 1, gap: 2 },
    presence: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.card, borderWidth: 1, borderColor: t.hair },
    presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.live },
    presenceLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    term: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
    definition: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: t.card,
      borderWidth: 1.5,
      borderColor: t.hair,
      fontSize: 15,
      lineHeight: 22,
      color: t.ink,
      fontFamily: SE_FONT.sans,
    },
    error: { fontSize: 14, color: t.kind.ask, fontFamily: SE_FONT.sans },
  });
}
