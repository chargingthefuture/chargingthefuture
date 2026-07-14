import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

// Public/unauthenticated state — uses MobileSocketRelayPublic.tsx mockup color
// Note: this screen is shown when the user is not signed in.
// The blurred preview items use no real data (no unauthenticated list endpoint)
// so they are omitted per real-data-only policy; the lock overlay is retained.

type Props = {
  onSignIn: () => void;
};

export function SocketRelayPublic({ onSignIn }: Props) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('socket-relay', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status bar row */}
      <View style={styles.statusBar}>
        <Text style={styles.time}>9:41</Text>
        <Text style={styles.statusDots}>●●●</Text>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>↗</Text>
          <Text style={styles.title}>Socket Relay</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Peer-to-peer needs board</Text>
        </View>
        <Text style={styles.description}>
          Post what you need, offer what you have. Clothing, furniture, skills,
          time — the survivor community connects directly.
        </Text>
        <TouchableOpacity style={styles.joinBtn} onPress={onSignIn}>
          <Text style={styles.joinBtnText}>Join the Hub — Free</Text>
        </TouchableOpacity>
      </View>

      {/* Lock overlay — blurred preview omitted (no unauthenticated data API) */}
      <View style={styles.lockZone}>
        <View style={styles.lockCircle}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
        <Text style={styles.lockHeading}>Sign in to post and respond</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={onSignIn}>
          <Text style={styles.signInBtnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { flexGrow: 1 },
  statusBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  time: { fontSize: 15, fontWeight: '700', color: t.textPrimary },
  statusDots: { fontSize: 12, color: t.textSecondary },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { fontSize: 20, color: accent },
  title: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: `${accent}20`,
    borderWidth: 1,
    borderColor: `${accent}40`,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: accent },
  description: { fontSize: 14, color: t.textSecondary, lineHeight: 21 },
  joinBtn: {
    paddingVertical: 14,
    borderRadius: t.radius,
    backgroundColor: accent,
    alignItems: 'center',
  },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  lockZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
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
  lockIcon: { fontSize: 20 },
  lockHeading: {
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
  },
  signInBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  });
}
