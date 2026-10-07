/**
 * PeerProgramming — the PeerProgramming screen in the Android app.
 *
 * Owner decision, 2026-10-06: the Android app carries any plugin that materially benefits from being
 * an installed app. PeerProgramming does, because its live Session call keeps running with the
 * screen off (the Stream foreground service registered in App.tsx), and an installed Android app can
 * share the phone's screen in that call (rule 105).
 *
 * The week's topic sits on top, then three tabs: Goals (the goal board, where the screen opens, as
 * on the web), Chat (the cohort conversation) and Session (the live call). Every tab reads the same
 * web routes the web app does. The Session tab stays mounted while another tab is open, so a member
 * can read the chat or the board without leaving the call.
 */
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChatTab } from './ChatTab';
import type { Room } from './PeerProgrammingApi';
import { GoalsTab } from './GoalsTab';
import { PPButton } from './PPButton';
import { SessionTab } from './SessionTab';
import { usePPTheme } from './usePPTheme';
import { useRoom } from './useRoom';

type Tab = 'goals' | 'chat' | 'session';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'goals', label: 'Goals' },
  { key: 'chat', label: 'Chat' },
  { key: 'session', label: 'Session' },
];

function TabRow({ tab, onSelect }: { tab: Tab; onSelect: (_tab: Tab) => void }) {
  const { tokens, accent } = usePPTheme();
  return (
    <View style={styles.tabs}>
      {TABS.map(({ key, label }) => {
        const active = key === tab;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, {
              borderRadius: tokens.radiusControl,
              borderColor: active ? accent : tokens.border,
              backgroundColor: active ? `${accent}1F` : 'transparent',
            }]}
          >
            <Text style={[styles.tabText, { color: active ? accent : tokens.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Header({ topic, onRefresh }: { topic: string | null; onRefresh: () => void }) {
  const { tokens } = usePPTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>PeerProgramming</Text>
        <Text style={[styles.topic, { color: tokens.textSecondary }]}>
          {topic ? `This week: ${topic}` : 'No topic has been published for this week yet.'}
        </Text>
      </View>
      <PPButton label="Refresh" onPress={onRefresh} />
    </View>
  );
}

// Chat and Session, which read the room. The Session tab stays mounted while another tab is open,
// so moving to Chat or Goals does not drop the call.
function RoomTabs({ tab, room, onPosted, onError }: {
  tab: Tab;
  room: Room;
  onPosted: () => Promise<void>;
  onError: (_message: string | null) => void;
}) {
  return (
    <>
      {tab === 'chat' ? <ChatTab room={room} onPosted={onPosted} onError={onError} /> : null}
      <View style={tab === 'session' ? null : styles.hidden}>
        <SessionTab room={room} />
      </View>
    </>
  );
}

export const PeerProgramming: React.FC = () => {
  const { tokens, accent } = usePPTheme();
  const { room, loading, error, setError, reload } = useRoom();
  const [tab, setTab] = useState<Tab>('goals');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    setRefreshKey((key) => key + 1);
    void reload();
  };

  return (
    <ScrollView style={[styles.root, { backgroundColor: tokens.bg }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Header topic={room?.topic?.title ?? null} onRefresh={refresh} />
      <TabRow tab={tab} onSelect={setTab} />
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      {tab === 'goals' ? <GoalsTab refreshKey={refreshKey} /> : null}
      {tab !== 'goals' && loading ? <ActivityIndicator style={styles.spinner} color={accent} accessibilityLabel="Loading the room" /> : null}
      {room ? <RoomTabs tab={tab} room={room} onPosted={reload} onError={setError} /> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerText: { flex: 1, gap: 4 },
  title: { fontSize: 22, fontWeight: '700' },
  topic: { fontSize: 13 },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, borderWidth: 1, paddingVertical: 8, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  error: { fontSize: 13, textAlign: 'center' },
  spinner: { marginTop: 24 },
  hidden: { display: 'none' },
});
