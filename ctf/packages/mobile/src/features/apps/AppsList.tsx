/**
 * AppsList — the Android app's home: the apps it carries, one card each. Tapping a card opens it.
 *
 * Owner decision, 2026-10-06: the Android app carries any plugin that materially benefits from being
 * an installed app, plus what that plugin needs to run (sign-in, account, bug reporting); everything
 * else is on the web app. Rule 105 holds the list and the reasons. A new entry here goes with a
 * feature folder, a rule 105 keep-list line and a parity contract.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, getAppAccent } from '../../theme';
import { getPluginEmoji } from '../../theme/plugin-visuals';

export type MobileAppKey = 'chyme' | 'beacon' | 'peer-programming';

// Summaries are the web plugin registry's (ctf/packages/web/lib/plugins/repository.ts), so the app
// and the web describe each app the same way.
const APPS: Array<{ key: MobileAppKey; name: string; summary: string }> = [
  { key: 'chyme', name: 'Chyme', summary: 'Live social audio rooms. Broadcast, listen, and connect in real time.' },
  {
    key: 'beacon',
    name: 'Beacon',
    summary: 'Live one-way broadcasts from Farah. Watch publicly with just a link; sign in to chat and react.',
  },
  { key: 'peer-programming', name: 'PeerProgramming', summary: 'Weekly global mastermind sessions.' },
];

export const AppsList: React.FC<{ onOpen: (_key: MobileAppKey) => void }> = ({ onOpen }) => {
  const { tokens, theme } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {APPS.map((app) => {
        const accent = getAppAccent(app.key, theme);
        return (
          <TouchableOpacity
            key={app.key}
            onPress={() => onOpen(app.key)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${app.name}`}
            style={[styles.card, { borderColor: accent, backgroundColor: tokens.surface, borderRadius: tokens.radius }]}
          >
            <Text style={styles.emoji}>{getPluginEmoji(app.key)}</Text>
            <View style={styles.text}>
              <Text style={[styles.name, { color: tokens.textPrimary }]}>{app.name}</Text>
              <Text style={[styles.summary, { color: tokens.textSecondary }]}>{app.summary}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: { borderWidth: 1, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' },
  emoji: { fontSize: 28 },
  text: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '700' },
  summary: { fontSize: 13, lineHeight: 18 },
});
