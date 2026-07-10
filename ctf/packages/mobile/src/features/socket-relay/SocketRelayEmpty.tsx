import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

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
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('socket-relay', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
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
          <React.Fragment key={step}>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{step}</Text>
              </View>
              <Text style={styles.stepLabel}>{label}</Text>
            </View>
          </React.Fragment>
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

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: {
    backgroundColor: t.surfaceAlt,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTime: { fontSize: 13, fontWeight: '600', color: t.textPrimary },
  headerStatus: { fontSize: 11, color: t.textSecondary },
  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: { fontSize: 16, color: accent },
  titleText: { fontSize: 15, fontWeight: '700', color: t.textPrimary },
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
    backgroundColor: `${accent}15`,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${accent}40`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconGlyph: { fontSize: 30, color: `${accent}50` },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: t.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: t.textSecondary,
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
    backgroundColor: `${accent}20`,
    borderWidth: 1,
    borderColor: `${accent}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontSize: 11, fontWeight: '700', color: accent },
  stepLabel: { fontSize: 13, color: t.textSecondary },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: t.radius,
    backgroundColor: accent,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: t.radius,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: `${accent}40`,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: accent },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: t.border,
    backgroundColor: t.surface,
  },
  footerText: { fontSize: 12, color: t.textSecondary },
  });
}
