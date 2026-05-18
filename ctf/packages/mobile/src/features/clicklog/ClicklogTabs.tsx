import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ClicklogCounter } from './ClicklogCounter';
import { ClicklogHistory } from './ClicklogHistory';

const TABS = [
  { key: 'counter', label: 'Counter' },
  { key: 'history', label: 'History' },
];

export function ClicklogTabs() {
  const [tab, setTab] = useState('counter');

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'counter' && <ClicklogCounter />}
        {tab === 'history' && <ClicklogHistory />}
      </View>
    </View>
  );
}

export default ClicklogTabs;

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: '#181A20', borderBottomWidth: 1, borderBottomColor: '#23262F' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#EAB308' },
  tabLabel: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },
  tabLabelActive: { color: '#EAB308' },
});
