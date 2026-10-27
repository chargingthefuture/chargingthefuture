// The 3.1 app frame, the Android copy of the web (components/se-frame/se-app-frame.tsx): one screen
// per tab, the open room and its bar, and the tab bar along the bottom.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SE_AVENHOOD, SE_AVENHOOD_DEFINITION, seTheme, type SeTab, type SeThemeChoice, type SeThemeTokens } from '@ctf/shared';
import { useAuth } from '../../auth/auth-context';
import { SeTabBar } from './SeTabBar';
import { SE_FONT } from './fonts';
import { useInterfaceVersion } from './interface-version';
import { TodayScreen } from './today/TodayScreen';
import { MeScreen } from './me/MeScreen';
import { useSeTheme } from './useSeTheme';
import { NewScreen } from './new/NewScreen';
import { ActivityScreen } from './activity/ActivityScreen';
import { PeopleScreen } from './people/PeopleScreen';
import { SeRoomBar, SeRoomHosts } from './rooms/SeRoomScreen';
import { SeRoomsProvider, useSeRooms } from './rooms/SeRooms';
import type { FeatureKey } from '../../navigation/screens';

const TODAY_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const TITLES: Record<SeTab, string> = {
  today: `Today in the ${SE_AVENHOOD}`,
  people: 'People',
  new: 'New',
  activity: 'Activity',
  me: 'Me',
};

type FrameProps = { onOpenAccount: () => void; onOpen: (_key: FeatureKey) => void };

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

function SeAppFrameBody({ onOpenAccount, onOpen }: FrameProps) {
  const { theme, setTheme } = useSeTheme();
  const t = seTheme(theme.color, theme.mode);
  const s = useMemo(() => makeStyles(t), [t]);
  const { user } = useAuth();
  const { switchTo, saving, error } = useInterfaceVersion();
  const [tab, setTab] = useState<SeTab>('today');
  const rooms = useSeRooms();
  const { minimize } = rooms;
  useFrameBack(tab, setTab, rooms.shown !== null, minimize);

  // Choosing a tab while a room is open puts the room in the bar above the tab bar.
  const select = useCallback(
    (next: SeTab) => {
      minimize();
      setTab(next);
    },
    [minimize],
  );
  const back = () => void switchTo('3.0');

  return (
    <View style={s.frame}>
      <ScrollView contentContainerStyle={s.screen} style={rooms.shown ? s.hidden : null}>
        <FrameHeader s={s} tab={tab} />

        <TabScreen t={t} tab={tab} user={user} theme={theme} onTheme={setTheme} onBack={back} saving={saving} onOpenAccount={onOpenAccount} onOpen={onOpen} />

        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
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
  user: { id: string; username?: string | null; isAdmin?: boolean } | null;
  theme: SeThemeChoice;
  onTheme: (_next: SeThemeChoice) => void;
  onBack: () => void;
  saving: boolean;
  onOpenAccount: () => void;
  onOpen: (_key: FeatureKey) => void;
};

function TabScreen({ t, tab, user, theme, onTheme, onBack, saving, onOpenAccount, onOpen }: TabScreenProps) {
  if (tab === 'me') {
    return (
      <MeScreen
        t={t}
        user={user}
        isAdmin={user?.isAdmin === true}
        onOpen={onOpen}
        theme={theme}
        onTheme={onTheme}
        onBack={onBack}
        saving={saving}
        onOpenAccount={onOpenAccount}
      />
    );
  }
  if (tab === 'today') return user ? <TodayScreen t={t} accountId={user.id} onOpen={onOpen} /> : null;
  if (tab === 'new') return <NewScreen t={t} onOpen={onOpen} />;
  if (tab === 'activity') return <ActivityScreen t={t} onOpen={onOpen} />;
  return <PeopleScreen t={t} onOpen={onOpen} />;
}

function FrameHeader({ s, tab }: { s: Styles; tab: SeTab }) {
  const [definitionOpen, setDefinitionOpen] = useState(false);
  if (tab !== 'today') {
    return (
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.title}>
          {TITLES[tab]}
        </Text>
      </View>
    );
  }
  return (
    <View style={s.header}>
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
