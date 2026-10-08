/**
 * PeerProgramming — the PeerProgramming screen in the Android app.
 *
 * Owner decision, 2026-10-06: the Android app carries any plugin that materially benefits from being
 * an installed app. PeerProgramming does, because its live Session call keeps running with the
 * screen off (the Stream foreground service registered in App.tsx), and an installed Android app can
 * share the phone's screen in that call (rule 105).
 *
 * Copied from the web shell (web components/peer-programming/peer-programming-shell.tsx) at phone
 * width (owner directive, 2026-10-08). The app's screen header above stands in for the web title row
 * (back, the Users icon, title, then this screen's Admin pill for an admin and Refresh, then report and
 * settings). Under it sits the web's tab row — Goals, Cohorts, Session, Direct Line — opening on
 * Goals (or on the Direct Line when the admin screen opened a cohort's room), then the open tab.
 * The Session tab stays mounted while another tab is open (and behind an error), so moving away
 * does not drop the call.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { HeaderPillButton, HeaderRefreshButton, useHeaderActions } from '../../components/shell/HeaderActions';
import { interFamily } from '../../components/ui';
import { ChatTab } from './ChatTab';
import { CohortsTab } from './CohortsTab';
import { GoalsTab } from './GoalsTab';
import { SessionTab } from './SessionTab';
import { usePPTheme } from './usePPTheme';
import { useRoom } from './useRoom';

type Tab = 'goals' | 'cohorts' | 'session' | 'chat';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'goals', label: 'Goals' },
  { key: 'cohorts', label: 'Cohorts' },
  { key: 'session', label: 'Session' },
  { key: 'chat', label: 'Direct Line' },
];

function TabRow({ tab, onSelect }: { tab: Tab; onSelect: (_tab: Tab) => void }) {
  const t = usePPTheme();
  return (
    <View style={[styles.tabs, { backgroundColor: t.HEADER, borderBottomColor: t.BORDER }]}>
      {TABS.map(({ key, label }) => {
        const active = key === tab;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, {
              borderRadius: t.r(8),
              borderColor: active ? t.ACCENT_TAB_BORDER : t.BORDER_STRONG,
              backgroundColor: active ? t.ACCENT_TINT_BG : 'transparent',
            }]}
          >
            <Text style={[styles.tabText, { color: active ? t.ACCENT : t.SUBTLE }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function PeerProgramming({ initialCohortId = null, onOpenAdmin }: { initialCohortId?: string | null; onOpenAdmin: () => void }) {
  const t = usePPTheme();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  const { room, loading, error, activeCohortId, switching, reload, openCohort, send } = useRoom(initialCohortId);
  // The goal board is where the room opens, as on the web; a cohort opened from the admin screen
  // opens on its conversation.
  const [tab, setTab] = useState<Tab>(initialCohortId ? 'chat' : 'goals');

  // The web header's Admin pill (admins only) and Refresh, which reloads the open cohort's room.
  useHeaderActions(
    <>
      {isAdmin ? <HeaderPillButton label="Admin" accent={t.ACCENT} accessibilityLabel="Admin panel" onPress={onOpenAdmin} /> : null}
      <HeaderRefreshButton onRefresh={reload} />
    </>,
    [isAdmin, t.ACCENT, onOpenAdmin, reload],
  );

  if (loading) return <LoadingScreen />;

  return (
    <View style={[styles.root, { backgroundColor: t.BG }]}>
      {error ? null : <TabRow tab={tab} onSelect={setTab} />}
      <ScrollView contentContainerStyle={error ? styles.errorFill : null} keyboardShouldPersistTaps="handled">
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!error && tab === 'goals' ? <GoalsTab /> : null}
        {!error && tab === 'cohorts' && room ? (
          <CohortsTab
            room={room}
            openCohortId={activeCohortId}
            switching={switching}
            isAdmin={isAdmin}
            onOpenCohort={(cohortId) => void openCohort(cohortId).then((opened) => opened && setTab('chat'))}
            onJoinSession={() => setTab('session')}
          />
        ) : null}
        {!error && tab === 'chat' && room ? <ChatTab room={room} onSend={send} /> : null}
        {room ? (
          <View style={!error && tab === 'session' ? null : styles.hidden}>
            <SessionTab room={room} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The app frame pads every screen (12 at the sides, 10 on top); the web shell runs edge to edge
  // under its header, so this screen takes that padding back.
  root: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  // The web tab row sits under its title row's 10px bottom padding; here the app header ends in a
  // border, so the row carries its own 8 on top.
  tabs: { flexDirection: 'row', gap: 6, paddingTop: 8, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 8, borderWidth: 1, alignItems: 'center' },
  tabText: { fontSize: 13, fontFamily: interFamily('600') },
  errorFill: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  error: { color: '#EF4444', fontSize: 16, textAlign: 'center', fontFamily: interFamily('400') },
  hidden: { display: 'none' },
});
