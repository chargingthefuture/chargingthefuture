import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';

interface StatCardProps {
  label: string;
  value: string;
  color: string;
}

// Design: stats grid card from MobileWorkforce
export function WorkforceStatCard({ label, value, color }: StatCardProps) {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
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

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
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
      color: t.textSecondary,
    },
  });
}
