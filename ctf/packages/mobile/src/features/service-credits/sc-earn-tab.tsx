import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { LEDGER } from './sc-styles';

// Static educational content about how to earn and where to spend ServiceCredits.
// Credit amounts shown here are platform documentation, not user-specific data.
// No user-specific balances or transactions are displayed.

// Mirrors the web list (service-credits.constants.ts, owner-confirmed model): the platform only
// funds a few rewards; the main ongoing way to earn is peer-to-peer — another member sends you
// credits for real help. The earlier list here (GentlePulse +5, LevelUp cohort +15, Refer +50)
// promised platform payouts that do not exist and was removed.
const EARN_WAYS = [
  { title: 'Verify your account', credits: '+100', color: '#22C55E' },
  { title: 'Help another member (they send you credits)', credits: 'Per exchange', color: '#38BDF8' },
  { title: 'Take part in SkillsHunt', credits: 'Per round', color: '#FBBF24' },
  { title: 'Contribute during a fundraiser', credits: 'Varies', color: '#A855F7' },
] as const;

const SPEND_APPS = [
  'LightHouse (housing)',
  'TrustTransport (transport)',
  'Foundation (trades)',
  'SocketRelay (relay services)',
  'Directory (skill listings)',
] as const;

export function EarnTab() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('service-credits', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
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
        <Text style={[s.cardLabel, { color: accent }]}>Where to Spend</Text>
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

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    heading: {
      fontSize: 16,
      fontWeight: '800',
      color: t.textPrimary,
      marginBottom: 4,
    },
    subheading: {
      fontSize: 12,
      color: t.textSecondary,
      marginBottom: 14,
    },
    card: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: t.borderFaint,
      marginBottom: 12,
    },
    cardLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: LEDGER.green,
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
    rowText: { fontSize: 13, color: t.textPrimary, flex: 1 },
    rowCredits: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
    spendCard: { borderColor: `${accent}20` },
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
      backgroundColor: LEDGER.green,
    },
    spendText: { fontSize: 13, color: t.textSecondary },
  });
}
