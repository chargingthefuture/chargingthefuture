import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  label: string;
  value: string;
  color: string;
}

// Design: stats grid card from MobileWorkforce
export function WorkforceStatCard({ label, value, color }: StatCardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color + '08', borderColor: color + '20' },
      ]}
    >
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 14,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
  },
});
