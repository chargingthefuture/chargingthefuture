// The 3.1 app frame, the Android copy of the web (components/se-frame/se-app-frame.tsx): one screen
// per tab, the open room and its bar, and the tab bar along the bottom.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_AVEN_DEFINITION, SE_AVENHOOD, SE_AVENHOOD_DEFINITION, seTheme, type SeTab, type SeThemeTokens } from '@ctf/shared';
import { useAuth } from '../../auth/auth-context';
import { SeAvatar } from '../../components/shared/SeAvatar';
import { SeTabBar } from './SeTabBar';
import { SE_FONT } from './fonts';
import { useInterfaceVersion } from './interface-version';
import { TodayScreen } from './today/TodayScreen';
import { NewScreen } from './new/NewScreen';
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
  const t = seTheme();
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

        <TabScreen t={t} s={s} tab={tab} user={user} onBack={back} saving={saving} onOpenAccount={onOpenAccount} onOpen={onOpen} />

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
  s: Styles;
  tab: SeTab;
  user: { id: string; username?: string | null } | null;
  onBack: () => void;
  saving: boolean;
  onOpenAccount: () => void;
  onOpen: (_key: FeatureKey) => void;
};

function TabScreen({ t, s, tab, user, onBack, saving, onOpenAccount, onOpen }: TabScreenProps) {
  if (tab === 'me') {
    const handle = user?.username ? `@${user.username}` : 'Survivor';
    return <MeTab s={s} user={user} handle={handle} onBack={onBack} saving={saving} onOpenAccount={onOpenAccount} />;
  }
  if (tab === 'today') return user ? <TodayScreen t={t} accountId={user.id} onOpen={onOpen} /> : null;
  if (tab === 'new') return <NewScreen t={t} onOpen={onOpen} />;
  return <NotBuiltCard s={s} onBack={onBack} saving={saving} />;
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

function MeTab({
  s,
  user,
  handle,
  onBack,
  saving,
  onOpenAccount,
}: {
  s: Styles;
  user: { id: string } | null;
  handle: string;
  onBack: () => void;
  saving: boolean;
  onOpenAccount: () => void;
}) {
  return (
    <>
      <View style={s.card}>
        <View style={s.meRow}>
          {user ? <SeAvatar accountId={user.id} size={56} /> : null}
          <Text style={s.handle}>{handle}</Text>
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.cardLabel}>About</Text>
        <Text style={s.cardTitle}>The {SE_AVENHOOD}</Text>
        <Text style={s.emptyText}>{SE_AVENHOOD_DEFINITION}</Text>
        <Text style={s.emptyText}>{SE_AVEN_DEFINITION}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardLabel}>Settings</Text>
        <Text style={s.emptyText}>You are using 3.1. You can go back to 3.0 at any time.</Text>
        <View style={s.buttonRow}>
          <SecondaryButton s={s} label="Back to 3.0" onPress={onBack} disabled={saving} />
          <TouchableOpacity accessibilityRole="link" onPress={onOpenAccount} style={s.textLink}>
            <Text style={s.textLinkLabel}>Account and data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

function NotBuiltCard({ s, onBack, saving }: { s: Styles; onBack: () => void; saving: boolean }) {
  return (
    <View style={s.card}>
      <Text style={s.emptyTitle}>This screen is still being built.</Text>
      <Text style={s.emptyText}>Everything you use today is in 3.0, unchanged.</Text>
      <SecondaryButton s={s} label="Back to 3.0" onPress={onBack} disabled={saving} />
    </View>
  );
}

function SecondaryButton({ s, label, onPress, disabled }: { s: Styles; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[s.secondaryButton, disabled ? s.disabled : null]}
    >
      <Text style={s.secondaryLabel}>{label}</Text>
    </TouchableOpacity>
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
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair, alignItems: 'flex-start' },
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
    cardTitle: { fontSize: 20, color: t.ink, fontFamily: SE_FONT.serif },
    cardLabel: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sansBold },
    emptyTitle: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    emptyText: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    meRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    handle: { fontSize: 17, color: t.ink, fontFamily: SE_FONT.sansBold },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
    secondaryButton: {
      minHeight: 44,
      paddingHorizontal: 16,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
      boxShadow: `0px 2px 0px ${t.line}`,
    },
    secondaryLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    disabled: { opacity: 0.6 },
    textLink: { minHeight: 44, justifyContent: 'center' },
    textLinkLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold, textDecorationLine: 'underline' },
    error: { fontSize: 14, color: t.kind.ask, fontFamily: SE_FONT.sans },
  });
}
