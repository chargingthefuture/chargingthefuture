import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

// Design: MobileWorkforcePublic — unauthenticated visitor view
// Live snapshot bars in the mockup have hardcoded pct values (37/25/20/18) with no real API
// → omitted per real-data-only rule; structural layout preserved.
// "Join the Hub" and "Sign in" buttons are navigation concerns owned by the auth shell → rendered inert.

function useWorkforceStyles() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('workforce', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return { styles };
}

function PublicStatBar({ label, color }: { label: string; color: string }) {
  const { styles } = useWorkforceStyles();
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      {/* Bar width omitted — no real pct backing without auth */}
      <View style={[styles.barTrack, { flex: 1, marginHorizontal: 8 }]}>
        <View style={[styles.barFill, { backgroundColor: color + '70', width: '40%' }]} />
      </View>
    </View>
  );
}

export function WorkforcePublic() {
  const { styles } = useWorkforceStyles();
  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusDots}>●●●</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Workforce</Text>
        </View>

        {/* Member count badge — omitted real number (requires auth to fetch dashboard) */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Survivor workforce data</Text>
        </View>

        <Text style={styles.description}>
          Real-time skills distribution, employment gaps, and personalized pathways across the survivor community.
        </Text>

        {/* Live snapshot — structural only; pct values omitted (no unauthed API).
            Bar colors are a data-series palette (green/orange/amber/grey) — stays raw per the
            cohesion-pass policy for chart/series swatches. */}
        <View style={styles.snapshot}>
          <Text style={styles.snapshotLabel}>Live snapshot</Text>
          <PublicStatBar label="Employed" color="#22C55E" />
          <PublicStatBar label="In Training" color="#F97316" />
          <PublicStatBar label="Seeking" color="#F59E0B" />
          <PublicStatBar label="Exploring" color="#6B7280" />
        </View>

        {/* Join CTA — navigation owned by auth shell; rendered as visual element only */}
        <View style={styles.ctaButton}>
          <Text style={styles.ctaText}>Join the Hub — Free</Text>
        </View>
      </View>

      {/* Locked content blur region */}
      <View style={styles.lockedRegion}>
        <View style={styles.blurPlaceholder} />
        <View style={styles.lockOverlay}>
          <View style={styles.lockCircle}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
          <Text style={styles.lockMessage}>Sign in for your personalized pathway</Text>
          {/* Sign in CTA — navigation owned by auth shell; rendered as visual element only */}
          <View style={styles.signInButton}>
            <Text style={styles.signInText}>Sign in</Text>
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
    statusDots: {
      fontSize: 12,
      color: t.textSecondary,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 16,
      gap: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: t.textPrimary,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: accent + '20',
      borderWidth: 1,
      borderColor: accent + '40',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: accent,
    },
    description: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 21,
    },
    snapshot: {
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
      padding: 14,
      backgroundColor: 'rgba(255,255,255,0.02)',
      gap: 8,
    },
    snapshotLabel: {
      fontSize: 11,
      color: t.textSecondary,
      marginBottom: 2,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    barLabel: {
      width: 65,
      fontSize: 11,
      color: t.textSecondary,
    },
    barTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.05)',
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 3,
    },
    ctaButton: {
      padding: 14,
      borderRadius: t.radius,
      backgroundColor: accent,
      alignItems: 'center',
    },
    ctaText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    lockedRegion: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 20,
      minHeight: 200,
      position: 'relative',
    },
    blurPlaceholder: {
      height: 160,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.borderFaint,
      backgroundColor: 'rgba(255,255,255,0.02)',
      opacity: 0.3,
    },
    lockOverlay: {
      position: 'absolute',
      top: 0,
      left: 20,
      right: 20,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    lockCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: accent + '50',
      backgroundColor: accent + '10',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockIcon: {
      fontSize: 18,
    },
    lockMessage: {
      fontSize: 14,
      fontWeight: '700',
      color: t.textPrimary,
      textAlign: 'center',
    },
    signInButton: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 9,
      backgroundColor: accent,
      alignItems: 'center',
    },
    signInText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
