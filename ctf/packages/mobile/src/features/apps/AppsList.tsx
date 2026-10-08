/**
 * AppsList — the Android app's home: the apps it carries, one card each. Tapping a card opens it.
 *
 * Owner decision, 2026-10-06: the Android app carries any plugin that materially benefits from being
 * an installed app, plus what that plugin needs to run (sign-in, account, bug reporting); everything
 * else is on the web app. A plugin that is carried is carried in full, matching its web plugin
 * screen for screen (owner decision, 2026-10-08). Rule 105 holds the list and the reasons. A new entry here goes with a
 * feature folder, a rule 105 keep-list line and a parity contract.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, getAppAccent } from '../../theme';
import { getPluginEmoji } from '../../theme/plugin-visuals';
import { interFamily } from '../../components/ui';

export type MobileAppKey = 'chyme' | 'beacon' | 'peer-programming' | 'foundation';

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
  { key: 'foundation', name: 'Foundation', summary: 'Find talent, tools, repairs, and infrastructure support in real time.' },
];

// Card backgrounds are the web's per-plugin `bg` (components/community-shell/shell-plugin-config.ts);
// the comic theme uses its flat card surface, as the web does.
const CARD_BG: Record<MobileAppKey, string> = {
  chyme: '#04160A',
  beacon: '#140303',
  'peer-programming': '#021208',
  foundation: '#1B1101',
};
const COMIC_CARD_BG = '#141414';

// Matches the web Apps panel at phone width (shell-apps-panel.tsx): an "All Apps" heading, then one
// card per app — tinted background, icon tile, name, summary and an "Open plugin →" pill. The web's
// sort and search controls are left out: with four apps there is nothing to sort or search.
export const AppsList: React.FC<{ onOpen: (_key: MobileAppKey) => void }> = ({ onOpen }) => {
  const { tokens, theme } = useTheme();
  const subtle = tokens.isComic ? tokens.textSecondary : '#6B7280';
  return (
    <ScrollView contentContainerStyle={styles.panel}>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>All Apps</Text>
      <Text style={[styles.sub, { color: subtle }]}>
        Your complete peer-to-peer marketplace — from survivor to thriver
      </Text>
      <View style={styles.grid}>
        {APPS.map((app) => {
          const color = getAppAccent(app.key, theme);
          const bg = tokens.isComic ? COMIC_CARD_BG : CARD_BG[app.key];
          return (
            <TouchableOpacity
              key={app.key}
              onPress={() => onOpen(app.key)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${app.name}`}
              activeOpacity={0.85}
              style={[
                styles.card,
                {
                  backgroundColor: tokens.isComic ? bg : `${bg}88`,
                  borderColor: tokens.isComic ? tokens.border : `${color}20`,
                  borderRadius: tokens.radius,
                },
              ]}
            >
              <View
                style={[
                  styles.icon,
                  { backgroundColor: `${color}20`, borderColor: `${color}35`, borderRadius: tokens.isComic ? 0 : 10 },
                ]}
              >
                <Text style={styles.emoji}>{getPluginEmoji(app.key)}</Text>
              </View>
              <Text style={[styles.name, { color: tokens.textPrimary }]}>{app.name}</Text>
              <Text style={[styles.summary, { color: subtle }]}>{app.summary}</Text>
              <View
                style={[
                  styles.action,
                  { borderColor: `${color}35`, backgroundColor: `${color}15`, borderRadius: tokens.isComic ? 0 : 8 },
                ]}
              >
                <Text style={[styles.actionText, { color }]}>Open plugin →</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.webNote, { color: subtle }]}>
        Every other app is on the web at app.chargingthefuture.com
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  panel: { padding: 20 },
  title: { fontSize: 22, fontFamily: interFamily('800'), marginBottom: 4 },
  sub: { fontSize: 14, fontFamily: interFamily('400'), marginBottom: 16 },
  grid: { gap: 12 },
  card: { padding: 18, borderWidth: 1 },
  icon: { width: 40, height: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emoji: { fontSize: 20 },
  name: { fontSize: 15, fontFamily: interFamily('700'), marginBottom: 4 },
  summary: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400'), marginBottom: 14 },
  action: { alignSelf: 'flex-start', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 14 },
  actionText: { fontSize: 12, fontFamily: interFamily('600') },
  webNote: { fontSize: 12, fontFamily: interFamily('500'), textAlign: 'center', marginTop: 20 },
});
