// The small accent pill the web puts in a plugin header: "Admin" on the member page for an admin
// (web components/shared/plugin-admin-button.tsx) and "Member view" on the admin screens
// (plugin-user-shell-button.tsx).

import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { interFamily } from '../../components/ui';
import { useChymeTokens } from './chyme-tokens';

export function ChymeHeaderPill({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  const t = useChymeTokens();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.pill, { borderRadius: t.radius(10), backgroundColor: `${t.ACCENT}1A`, borderColor: `${t.ACCENT}40` }]}
    >
      <Text numberOfLines={1} style={[styles.text, { color: t.ACCENT }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: { height: 34, paddingHorizontal: 12, borderWidth: 1, justifyContent: 'center', flexShrink: 0 },
  text: { fontSize: 13, fontFamily: interFamily('700') },
});
