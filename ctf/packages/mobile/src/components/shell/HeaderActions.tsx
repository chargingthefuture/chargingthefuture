// The buttons a screen puts in its header's actions slot, copied from the web:
//   - HeaderPill          web PluginAdminButton ("Admin") and PluginUserShellButton ("Member view"):
//                         34px tall, accent-tinted, 13px bold.
//   - HeaderRefreshButton web AdminRefreshControl: the 38px refresh square every admin screen carries.
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { interFamily } from '../ui';

export function HeaderPill({ label, accent, onPress, accessibilityLabel }: {
  label: string;
  accent: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.pill,
        { borderRadius: tokens.isComic ? 0 : 10, backgroundColor: `${accent}1A`, borderColor: `${accent}40` },
      ]}
    >
      <Text style={[styles.pillText, { color: accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Refreshing remounts the screen (the caller changes its key), as the web control does, and
// announces it to a screen reader the way the web's polite live region does.
export function HeaderRefreshButton({ accent, onRefresh }: { accent: string; onRefresh: () => void }) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => {
        onRefresh();
        AccessibilityInfo.announceForAccessibility('Screen refreshed.');
      }}
      accessibilityRole="button"
      accessibilityLabel="Refresh this screen"
      style={[
        styles.square,
        { borderRadius: tokens.isComic ? 0 : 10, backgroundColor: `${accent}1A`, borderColor: `${accent}4D` },
      ]}
    >
      <RefreshCw size={18} color={accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: { height: 34, paddingHorizontal: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 13, fontFamily: interFamily('700'), fontWeight: '700' },
  square: { width: 38, height: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
