import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LighthouseScreen } from './LighthouseScreen';
import { LighthouseMatches } from './LighthouseMatches';

const TABS = [
  { key: 'browse', label: 'Browse' },
  { key: 'matches', label: 'Matches' },
  { key: 'chat', label: 'Chat' },
];

export const LighthouseTabs = () => {
  const [tab, setTab] = useState('browse');

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            // ...existing code...
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'browse' && <LighthouseScreen />}
        {tab === 'matches' && <LighthouseMatches />}
        {tab === 'chat' && <LighthouseStreamTab />}
      </View>
    </View>
  );
};

import { LighthouseStreamTab } from './LighthouseStreamTab';

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: '#181A20', borderBottomWidth: 1, borderBottomColor: '#23262F' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#EAB308' },
  tabLabel: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },
  tabLabelActive: { color: '#EAB308' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { color: '#9CA3AF', fontSize: 16 },
  error: { color: '#EF4444', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#EAB308' },
  subtitle: { fontSize: 15, color: '#9CA3AF' },
});
