import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';


/**
 * Foundation public/unauthenticated state — mirrors MobileFoundationPublic.tsx mockup.
 * Shown when user has no active session.
 */
export function FoundationPublic({ onSignIn }: { onSignIn?: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('foundation', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.container}>
      {/* Status bar row */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusSignal}>●●●</Text>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>&#x1F528;</Text>
        <Text style={styles.headerTitle}>Foundation</Text>
      </View>

      {/* Hero copy */}
      <View style={styles.hero}>
        <Text style={styles.heroBody}>
          Electricians, plumbers, carpenters, and more — fellow community members. Pay with ServiceCredits.
        </Text>
        <TouchableOpacity style={styles.joinBtn} onPress={onSignIn}>
          <Text style={styles.joinBtnText}>Join the Hub — Free</Text>
        </TouchableOpacity>
      </View>

      {/* Blurred provider list preview — static, no real data */}
      <View style={styles.previewWrap}>
        <View style={styles.blurOverlay}>
          {/* Lock gate overlay */}
          <View style={styles.lockGate}>
            <View style={styles.lockCircle}>
              <Text style={styles.lockIcon}>&#x1F512;</Text>
            </View>
            <Text style={styles.lockText}>Sign in to book tradespeople</Text>
            <TouchableOpacity style={styles.signInBtn} onPress={onSignIn}>
              <Text style={styles.signInBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    statusBar: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    statusTime: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textPrimary,
    },
    statusSignal: {
      fontSize: 12,
      color: t.textSecondary,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerIcon: {
      fontSize: 20,
      color: accent,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: t.textPrimary,
    },
    hero: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 12,
    },
    heroBody: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 21,
    },
    joinBtn: {
      padding: 14,
      borderRadius: t.radius,
      backgroundColor: accent,
      alignItems: 'center',
    },
    joinBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    previewWrap: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 20,
      position: 'relative',
    },
    blurOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockGate: {
      alignItems: 'center',
      gap: 12,
    },
    lockCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: `${accent}50`,
      backgroundColor: `${accent}10`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockIcon: {
      fontSize: 20,
      color: accent,
    },
    lockText: {
      fontSize: 15,
      fontWeight: '700',
      color: t.textPrimary,
      textAlign: 'center',
    },
    signInBtn: {
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 9,
      backgroundColor: accent,
      alignItems: 'center',
    },
    signInBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
