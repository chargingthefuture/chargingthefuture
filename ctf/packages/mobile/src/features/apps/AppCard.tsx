// One card of the Apps home, copied from the web Apps panel card (shell-apps-panel.tsx and
// .appCard* in community-shell.module.css). Tapping the card highlights it (the web's selected state:
// a denser tint and a stronger border); the "Open plugin →" pill opens the app.
//
// The web's status badge ("Coming soon" / "Alpha" / "Beta") is left out: it shows only for an app
// that is not fully available, and every app this app carries is fully available.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';
import { interFamily } from '../../components/ui';

type AppCardProps = {
  name: string;
  summary: string;
  emoji: string;
  /** The web PLUGIN_VISUALS accent for the active theme. */
  color: string;
  /** The web PLUGIN_VISUALS card base for the active theme. */
  bg: string;
  isActive: boolean;
  onSelect: () => void;
  onOpen: () => void;
};

export function AppCard({ name, summary, emoji, color, bg, isActive, onSelect, onOpen }: AppCardProps) {
  const { tokens } = useTheme();
  const subtle = tokens.isComic ? tokens.textSecondary : '#6B7280';
  const square = tokens.isComic;
  return (
    <TouchableOpacity
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={name}
      activeOpacity={1}
      style={[
        styles.card,
        {
          backgroundColor: isActive ? `${bg}ee` : `${bg}88`,
          borderColor: isActive ? `${color}60` : `${color}20`,
          borderRadius: square ? 0 : 14,
        },
      ]}
    >
      <View style={styles.top}>
        <View
          style={[
            styles.icon,
            { backgroundColor: `${color}20`, borderColor: `${color}35`, borderRadius: square ? 0 : 10 },
          ]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
      </View>
      <Text style={[styles.name, { color: tokens.textPrimary }]}>{name}</Text>
      <Text style={[styles.summary, { color: subtle }]}>{summary}</Text>
      <TouchableOpacity
        onPress={onOpen}
        accessibilityRole="link"
        accessibilityLabel={`Open ${name}`}
        style={[
          styles.action,
          { borderColor: `${color}35`, backgroundColor: `${color}15`, borderRadius: square ? 0 : 8 },
        ]}
      >
        <Text style={[styles.actionText, { color }]}>Open plugin →</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  icon: { width: 40, height: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  name: { fontSize: 15, fontFamily: interFamily('700'), marginBottom: 4 },
  summary: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400'), marginBottom: 14 },
  action: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 14 },
  actionText: { fontSize: 12, fontFamily: interFamily('600') },
});
