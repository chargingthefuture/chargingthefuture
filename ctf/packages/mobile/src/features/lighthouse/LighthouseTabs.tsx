import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import { LighthouseScreen } from './LighthouseScreen';
import { LighthouseHost } from './LighthouseHost';
import { LighthouseSeekerProfile } from './LighthouseSeekerProfile';
import { LighthouseMatches } from './LighthouseMatches';
import { LighthouseStreamTab } from './LighthouseStreamTab';

type TabKey = 'browse' | 'host' | 'matches' | 'profile' | 'chat';

interface NavItem {
  key: TabKey;
  label: string;
  icon: string;
  activeIcon: string;
}

const NAV: NavItem[] = [
  { key: 'browse', label: 'Browse', icon: 'search-outline', activeIcon: 'search' },
  { key: 'host', label: 'List your place', icon: 'home-outline', activeIcon: 'home' },
  { key: 'matches', label: 'Matches', icon: 'mail-outline', activeIcon: 'mail' },
  { key: 'profile', label: 'Your details', icon: 'person-outline', activeIcon: 'person' },
  { key: 'chat', label: 'Direct Line', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
];

export const LighthouseTabs: React.FC = () => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [tab, setTab] = useState<TabKey>('browse');

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {tab === 'browse' && <LighthouseScreen onNavigateToProfile={() => setTab('profile')} />}
        {tab === 'host' && <LighthouseHost />}
        {tab === 'matches' && <LighthouseMatches />}
        {tab === 'profile' && <LighthouseSeekerProfile />}
        {tab === 'chat' && <LighthouseStreamTab />}
      </View>
      <View style={styles.navBar}>
        {NAV.map(({ key, label, icon, activeIcon }) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.navItem}
              onPress={() => setTab(key)}
              activeOpacity={0.7}
            >
              <View style={[styles.navIconBox, active && styles.navIconBoxActive]}>
                <Ionicons
                  name={(active ? activeIcon : icon) as 'search'}
                  size={20}
                  color={active ? accent : tokens.textSecondary}
                />
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    content: {
      flex: 1,
    },
    navBar: {
      height: 72,
      backgroundColor: t.surfaceAlt,
      borderTopWidth: 1,
      borderTopColor: t.borderFaint,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 8,
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    navIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIconBoxActive: {
      backgroundColor: `${accent}20`,
    },
    navLabel: {
      fontSize: 10,
      color: t.textMuted,
      fontWeight: '400',
    },
    navLabelActive: {
      color: accent,
      fontWeight: '600',
    },
  });
}
