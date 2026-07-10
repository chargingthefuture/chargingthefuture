import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

// Design: MobileWorkforceEmpty — no skills/profile listed yet
// "Add Skills" and "View Demand Map" CTAs have no mobile API backing → layout preserved, buttons inert

export function WorkforceEmpty() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('workforce', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workforce</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>≡</Text>
        </View>
        <Text style={styles.title}>No skills listed yet</Text>
        <Text style={styles.subtitle}>
          Add your verified skills to appear in workforce demand data and get matched to opportunities.
        </Text>
        {/* Add Skills / View Demand Map actions have no mobile route yet — omitted per real-data-only rule */}
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    header: {
      backgroundColor: t.surfaceAlt,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textPrimary,
    },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: `${accent}15`,
      borderWidth: 1,
      borderColor: `${accent}40`,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    iconText: {
      fontSize: 30,
      color: `${accent}50`,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: t.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
    },
  });
}
