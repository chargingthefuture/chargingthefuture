import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { WorkforceProfileData } from './api';

interface ProfileCardProps {
  profile: WorkforceProfileData;
}

// Design: profile section — shows real profile fields (occupationName, skillLevel, region, recruitedState)
// Pathways match % has no API backing → omitted per real-data-only rule
const COLOR = '#B45309';

export function WorkforceProfileCard({ profile }: ProfileCardProps) {
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
        <Text style={[styles.rowValue, { color: profile.recruitedState ? '#22C55E' : '#F59E0B' }]}>
          {profile.recruitedState ? 'Recruited' : 'Seeking'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLOR + '08',
    borderWidth: 1,
    borderColor: COLOR + '20',
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F9FAFB',
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
    color: '#9CA3AF',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E8EAF0',
  },
});
