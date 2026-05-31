import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const COLOR = '#FB923C';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const SUBTLE = '#6B7280';

const STEPS = [
  { step: '1', label: 'Post a need or offer' },
  { step: '2', label: 'Matched survivor responds' },
  { step: '3', label: 'Connection made securely' },
];

type Props = {
  onPostNeed: () => void;
  onOfferHelp: () => void;
};

export function SocketRelayEmpty({ onPostNeed, onOfferHelp }: Props) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTime}>9:41</Text>
        <Text style={styles.headerStatus}>●●●</Text>
      </View>

      {/* Title bar */}
      <View style={styles.titleBar}>
        <Text style={styles.titleIcon}>↗</Text>
        <Text style={styles.titleText}>SocketRelay</Text>
      </View>

      {/* Empty body */}
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconGlyph}>↗</Text>
        </View>
        <Text style={styles.heading}>No relay requests yet</Text>
        <Text style={styles.subtext}>
          Post a need or offer help. All requests are anonymised and routed
          securely through the community.
        </Text>

        {STEPS.map(({ step, label }) => (
          <View key={step} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>{step}</Text>
            </View>
            <Text style={styles.stepLabel}>{label}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.primaryBtn} onPress={onPostNeed}>
          <Text style={styles.primaryBtnText}>+ Post a Need</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onOfferHelp}>
          <Text style={styles.secondaryBtnText}>♥ Offer Help</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🛡 Anonymous posting always available · No ID required
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: '#090B0F',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTime: { fontSize: 13, fontWeight: '600', color: '#F9FAFB' },
  headerStatus: { fontSize: 11, color: SUBTLE },
  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: { fontSize: 16, color: COLOR },
  titleText: { fontSize: 15, fontWeight: '700', color: '#F9FAFB' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${COLOR}40`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconGlyph: { fontSize: 30, color: `${COLOR}50` },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: SUBTLE,
    lineHeight: 22,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    width: '100%',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontSize: 11, fontWeight: '700', color: COLOR },
  stepLabel: { fontSize: 13, color: SUBTLE },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLOR,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: COLOR },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: SURFACE,
  },
  footerText: { fontSize: 12, color: SUBTLE },
});
