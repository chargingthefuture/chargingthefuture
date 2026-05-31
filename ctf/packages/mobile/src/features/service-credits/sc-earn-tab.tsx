import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLOR, colors } from './sc-styles';

// Static educational content about how to earn and where to spend ServiceCredits.
// Credit amounts shown here are platform documentation, not user-specific data.
// No user-specific balances or transactions are displayed.

const EARN_WAYS = [
  { title: 'Complete a GentlePulse session', credits: '+5 credits', color: '#8B5CF6' },
  { title: 'Attend a LevelUp cohort', credits: '+15 credits', color: '#3B82F6' },
  { title: 'Refer a survivor', credits: '+50 credits', color: '#22C55E' },
] as const;

const SPEND_APPS = [
  'LightHouse (housing)',
  'TrustTransport (transport)',
  'Foundation (trades)',
  'SocketRelay (relay services)',
  'Directory (skill listings)',
] as const;

export function EarnTab() {
  return (
    <View>
      <Text style={s.heading}>Earn Credits</Text>
      <Text style={s.subheading}>
        Contribute to the community and earn ServiceCredits.
      </Text>

      <View style={s.card}>
        <Text style={s.cardLabel}>Ways to Earn</Text>
        {EARN_WAYS.map((w) => (
          <React.Fragment key={w.title}>
            <View style={[s.row, { borderColor: `${w.color}20` }]}>
              <Text style={s.rowText}>{w.title}</Text>
              <Text style={[s.rowCredits, { color: w.color }]}>{w.credits}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={[s.card, s.spendCard]}>
        <Text style={[s.cardLabel, { color: COLOR }]}>Where to Spend</Text>
        {SPEND_APPS.map((app) => (
          <React.Fragment key={app}>
            <View style={s.spendRow}>
              <View style={s.dot} />
              <Text style={s.spendText}>{app}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 12,
    color: colors.textDim,
    marginBottom: 14,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.green,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowText: { fontSize: 13, color: colors.text, flex: 1 },
  rowCredits: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  spendCard: { borderColor: `${COLOR}20` },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  spendText: { fontSize: 13, color: colors.textSubtle },
});
