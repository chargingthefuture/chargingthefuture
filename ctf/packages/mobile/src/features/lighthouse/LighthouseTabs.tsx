import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LighthouseScreen } from './LighthouseScreen';
import { LighthouseHost } from './LighthouseHost';
import { LighthouseMatches } from './LighthouseMatches';
import { LighthouseStreamTab } from './LighthouseStreamTab';

const COLOR = '#60A5FA';
const DARK = '#090B0F';

type TabKey = 'browse' | 'host' | 'matches' | 'chat';

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
  { key: 'chat', label: 'Direct Line', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
];

export const LighthouseTabs: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('browse');

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {tab === 'browse' && <LighthouseScreen />}
        {tab === 'host' && <LighthouseHost />}
        {tab === 'matches' && <LighthouseMatches />}
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
                  color={active ? COLOR : '#6B7280'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  content: {
    flex: 1,
  },
  navBar: {
    height: 72,
    backgroundColor: DARK,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: `${COLOR}20`,
  },
  navLabel: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '400',
  },
  navLabelActive: {
    color: COLOR,
    fontWeight: '600',
  },
});
