import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import type { WorkforceProfileData } from './api';

interface ProfileCardProps {
  profile: WorkforceProfileData;
}

// Design: profile section — shows real profile fields (occupationName, skillLevel, region, recruitedState)
// Pathways match % has no API backing → omitted per real-data-only rule

export function WorkforceProfileCard({ profile }: ProfileCardProps) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('workforce', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>My Workforce Profile</Text>

      {profile.occupationName ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Occupation</Text>
          <Text style={styles.rowValue}>{profile.occupationName}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Skill Level</Text>
        <Text style={styles.rowValue}>{profile.skillLevel}</Text>
      </View>

      {profile.region ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Region</Text>
          <Text style={styles.rowValue}>{profile.region}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Status</Text>
        {/* Recruited/Seeking is a mixed green/amber status pair with no sanctioned token — stays raw. */}
        <Text style={[styles.rowValue, { color: profile.recruitedState ? '#22C55E' : '#F59E0B' }]}>
          {profile.recruitedState ? 'Recruited' : 'Seeking'}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: accent + '08',
      borderWidth: 1,
      borderColor: accent + '20',
      marginBottom: 16,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: t.textPrimary,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    rowLabel: {
      fontSize: 13,
      color: t.textSecondary,
    },
    rowValue: {
      fontSize: 13,
      fontWeight: '600',
      color: t.textShell,
    },
  });
}
