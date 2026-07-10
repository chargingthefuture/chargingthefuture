import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

export const PeerProgrammingEmpty = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
  <View style={styles.root}>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Not in a cohort yet</Text>
      <Text style={styles.cardDesc}>
        You will be matched with a cohort of survivors at your level during the next weekly assignment.
        Check back after the next assignment cycle.
      </Text>
    </View>
  </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.bg,
    padding: 20,
  },
  card: {
    borderRadius: t.radius,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    padding: 14,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: accent,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: t.textSecondary,
    lineHeight: 20,
  },
  });
}
