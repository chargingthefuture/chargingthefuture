// The 3.1 tab bar, copied from the web (components/se-frame/se-tab-bar.tsx): a pill along the
// bottom with Today, People, the round + New button, Activity and Me.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SE_TAB_LABELS, SE_TABS, type SeTab, type SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from './fonts';

function TabIcon({ tab, color }: { tab: SeTab; color: string }) {
  const isNew = tab === 'new';
  const size = isNew ? 22 : 20;
  const stroke = { stroke: color, strokeWidth: isNew ? 2.6 : 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {tab === 'today' ? <Path d="M4 7h16M4 12h16M4 17h10" {...stroke} /> : null}
      {tab === 'people' ? (
        <>
          <Circle cx={9} cy={8} r={3.5} {...stroke} />
          <Path d="M2.5 20c.8-3.5 3.4-5 6.5-5s5.7 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.3 3.6 5" {...stroke} />
        </>
      ) : null}
      {tab === 'new' ? <Path d="M12 5v14M5 12h14" {...stroke} /> : null}
      {tab === 'activity' ? <Path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0" {...stroke} /> : null}
      {tab === 'me' ? (
        <>
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4 21c1-4 4-6 8-6s7 2 8 6" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

export function SeTabBar({ t, active, onSelect }: { t: SeThemeTokens; active: SeTab; onSelect: (_tab: SeTab) => void }) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Main"
      style={[styles.bar, { backgroundColor: t.card, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` }]}
    >
      {SE_TABS.map((tab) => {
        const selected = active === tab;
        if (tab === 'new') {
          return (
            <View key={tab} style={styles.slot}>
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityLabel={SE_TAB_LABELS.new}
                accessibilityState={{ selected }}
                onPress={() => onSelect(tab)}
                style={[styles.newButton, { backgroundColor: t.btn, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` }]}
              >
                <TabIcon tab={tab} color={t.onBtn} />
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <TouchableOpacity
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab)}
            style={[styles.tab, selected ? { backgroundColor: t.sunk } : null]}
          >
            <TabIcon tab={tab} color={selected ? t.ink : t.soft} />
            <Text style={[styles.label, { color: selected ? t.ink : t.soft, fontFamily: selected ? SE_FONT.sansBold : SE_FONT.sansSemi }]}>
              {SE_TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  slot: { flex: 1, alignItems: 'center' },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 999 },
  label: { fontSize: 11 },
  newButton: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
