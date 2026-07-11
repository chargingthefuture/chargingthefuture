import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

export const PeerProgrammingPublic = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
  <View style={styles.root}>
    <Text style={styles.title}>PeerProgramming</Text>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>Deterministic global cohorts</Text>
    </View>
    <Text style={styles.description}>
      Weekly cohorts across countries. You are always placed — no competitive selection, guaranteed spot.
    </Text>
    <View style={styles.hint}>
      <Text style={styles.hintText}>Sign in to get matched with your cohort.</Text>
    </View>
  </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.bg,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: t.textPrimary,
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: `${accent}20`,
    borderWidth: 1,
    borderColor: `${accent}40`,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    color: accent,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: t.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  hint: {
    padding: 16,
    borderRadius: t.radius,
    backgroundColor: `${accent}08`,
    borderWidth: 1,
    borderColor: `${accent}20`,
  },
  hintText: {
    fontSize: 15,
    fontWeight: '700',
    color: t.textPrimary,
    textAlign: 'center',
  },
  });
}
