/**
 * AppsList — the Android app's home: the apps it carries, one card each.
 *
 * Owner decision, 2026-10-06: the Android app carries any plugin that materially benefits from being
 * an installed app, plus what that plugin needs to run (sign-in, account, bug reporting); everything
 * else is on the web app. A plugin that is carried is carried in full, matching its web plugin
 * screen for screen (owner decision, 2026-10-08). Rule 105 holds the list and the reasons. A new entry here goes with a
 * feature folder, a rule 105 keep-list line and a parity contract.
 *
 * Drawn as the web Apps panel at phone width (components/community-shell/shell-apps-panel.tsx and
 * .apps* in community-shell.module.css): the "All Apps" heading and line with the Sort control beside
 * them, the search box, the no-match line, then the cards.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, getAppAccent } from '../../theme';
import { getPluginEmoji } from '../../theme/plugin-visuals';
import { interFamily } from '../../components/ui';
import { AppCard } from './AppCard';
import { AppsSortSelect } from './AppsSortSelect';
import { sortApps, useAppsOrder } from './useAppsOrder';

export type MobileAppKey = 'chyme' | 'beacon' | 'peer-programming' | 'foundation';

// Names and summaries are the web plugin registry's (ctf/packages/web/lib/plugins/repository.ts and
// the ctf_plugin_registry seed), so the app and the web describe each app the same way.
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

// Card bases are the web's per-plugin `bg` (components/community-shell/shell-plugin-config.ts); the
// comic theme uses its flat ink surface for every card, as the web does.
const CARD_BG: Record<MobileAppKey, string> = {
  chyme: '#04160A',
  beacon: '#140303',
  'peer-programming': '#021208',
  foundation: '#1B1101',
};
const COMIC_CARD_BG = '#141414';

export const AppsList: React.FC<{ onOpen: (_key: MobileAppKey) => void }> = ({ onOpen }) => {
  const { tokens, theme } = useTheme();
  const { sortMode, setSortMode, recent, counts, recordOpen } = useAppsOrder();
  const [query, setQuery] = useState('');
  const [activeApp, setActiveApp] = useState<MobileAppKey | null>(null);
  const subtle = tokens.isComic ? tokens.textSecondary : '#6B7280';

  const shown = useMemo(() => {
    const ordered = sortApps(APPS, sortMode, recent, counts);
    const needle = query.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter((app) => `${app.name} ${app.summary}`.toLowerCase().includes(needle));
  }, [sortMode, recent, counts, query]);

  const open = (key: MobileAppKey) => {
    setActiveApp(key);
    recordOpen(key);
    onOpen(key);
  };

  return (
    <ScrollView contentContainerStyle={styles.panel} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>All Apps</Text>
          <Text style={[styles.sub, { color: subtle }]}>
            Your complete peer-to-peer marketplace — from survivor to thriver
          </Text>
        </View>
        <AppsSortSelect value={sortMode} onChange={setSortMode} />
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search apps…"
        placeholderTextColor={tokens.textMuted}
        accessibilityLabel="Search apps…"
        returnKeyType="search"
        autoCorrect={false}
        style={[styles.search, { color: tokens.textSecondary, borderRadius: tokens.isComic ? 0 : 8 }]}
      />

      {shown.length === 0 ? (
        <Text style={[styles.empty, { color: subtle }]}>No matching plugins. Try a different search.</Text>
      ) : null}

      <View style={styles.grid}>
        {shown.map((app) => (
          <AppCard
            key={app.key}
            name={app.name}
            summary={app.summary}
            emoji={getPluginEmoji(app.key)}
            color={getAppAccent(app.key, theme)}
            bg={tokens.isComic ? COMIC_CARD_BG : CARD_BG[app.key]}
            isActive={activeApp === app.key}
            onSelect={() => setActiveApp(activeApp === app.key ? null : app.key)}
            onOpen={() => open(app.key)}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  panel: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  headerText: { flexShrink: 1 },
  title: { fontSize: 22, fontFamily: interFamily('800'), marginBottom: 4 },
  sub: { fontSize: 14, fontFamily: interFamily('400') },
  search: {
    marginBottom: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    fontSize: 13,
    fontFamily: interFamily('400'),
  },
  empty: { fontSize: 14, fontFamily: interFamily('400'), marginBottom: 12 },
  grid: { gap: 12 },
});
