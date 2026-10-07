/**
 * Foundation — the Android app's Foundation screen: live 1:1 calls only.
 *
 * Owner decision, 2026-10-06: Foundation joins the Android app for its instant calls, because an
 * installed app can ring the phone with the app closed and keep a call going with the screen off. So
 * this screen holds the two things a call needs: "Call alerts on this device" and the member's
 * connections with "Connect now". The incoming ring and the call itself are drawn by
 * FoundationCallController at the app shell, above every tab. Search, quotes, history and the other
 * settings stay on the web (rule 105).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { FoundationCallAlerts } from './FoundationCallAlerts';
import { FoundationConnections } from './FoundationConnections';
import { useFDTheme } from './useFDTheme';

export function Foundation() {
  const { tokens } = useFDTheme();
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Text style={[styles.note, { color: tokens.textSecondary }]}>Sign in to take and make Foundation calls.</Text>;
  }
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>Foundation calls</Text>
      <Text style={[styles.note, { color: tokens.textSecondary }]}>
        Live 1:1 audio calls with the people you are connected with. Calls you receive ring here too.
      </Text>
      <FoundationCallAlerts />
      <Text style={[styles.section, { color: tokens.textPrimary }]}>Your connections</Text>
      <FoundationConnections viewerUserId={user?.id ?? null} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '800' },
  section: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  note: { fontSize: 13.5, lineHeight: 19 },
});
