import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

/**
 * Foundation empty state — mirrors MobileFoundationEmpty.tsx mockup.
 * Shown when no providers are found for the current query.
 */
export function FoundationEmpty() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('foundation', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {/* Hammer placeholder — uses text glyph since lucide-react-native not available */}
        <Text style={styles.iconText}>&#x1F528;</Text>
      </View>
      <Text style={styles.title}>No listings yet</Text>
      <Text style={styles.desc}>
        Post a service you offer or a job you need done. Paid in ServiceCredits or cash — your choice.
      </Text>
      <View style={[styles.btn, { backgroundColor: accent }]}>
        <Text style={styles.btnText}>Post a Service</Text>
      </View>
      <View style={[styles.btn, { backgroundColor: tokens.surface, borderColor: tokens.border, borderWidth: 1 }]}>
        <Text style={[styles.btnText, { color: tokens.textPrimary }]}>Get Job Alerts</Text>
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
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
      opacity: 0.5,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: t.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
    },
    desc: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 22,
      marginBottom: 28,
      textAlign: 'center',
    },
    btn: {
      width: '100%',
      padding: 14,
      borderRadius: t.radius,
      alignItems: 'center',
      marginBottom: 12,
    },
    btnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
  });
}
