import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

// Loud banner shown at the top of a mobile admin screen when the signed-in operator is a demo
// participant. Admin tools (approve, retry rewards, mint, burn) run against whichever DB schema the
// caller's demo flag selects, so a demo-mode operator can act on demo data without realizing it —
// e.g. a governance burn that hits an empty demo wallet and fails as "Insufficient balance.". This
// makes the demo context impossible to miss. Mirrors the web AdminDemoBanner
// (ctf/packages/web/components/shared/admin-demo-banner.tsx); rendered only in demo mode, so the
// normal production operator view is unchanged.
export function AdminDemoBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.banner, style]} accessibilityRole="alert">
      <Text style={styles.text}>
        ⚠ Demo mode — you are acting on demo data, not production. Approvals, reward retries, mints,
        and burns here change the demo schema only. Turn off demo mode to operate production.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#B45309',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
});
