import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const BG = '#0F1117';
const TEXT = '#F9FAFB';
const TEXT_DIM = '#9CA3AF';
const COLOR = '#F59E0B';

/**
 * Foundation public/unauthenticated state — mirrors MobileFoundationPublic.tsx mockup.
 * Shown when user has no active session.
 */
export function FoundationPublic({ onSignIn }: { onSignIn?: () => void }) {
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
          Electricians, plumbers, carpenters, and more — fellow community members. Pay with Service Credits.
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
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
    color: TEXT,
  },
  statusSignal: {
    fontSize: 12,
    color: TEXT_DIM,
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
    color: COLOR,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  heroBody: {
    fontSize: 14,
    color: TEXT_DIM,
    lineHeight: 21,
  },
  joinBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLOR,
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
    borderColor: `${COLOR}50`,
    backgroundColor: `${COLOR}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 20,
    color: COLOR,
  },
  lockText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
  },
  signInBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 9,
    backgroundColor: COLOR,
    alignItems: 'center',
  },
  signInBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
