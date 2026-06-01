import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLOR = '#8B5CF6';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const SUBTLE = '#6B7280';

export const PeerProgrammingEmpty = () => (
  <View style={styles.root}>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Not in a cohort yet</Text>
      <Text style={styles.cardDesc}>
        You will be matched with a cohort of survivors at your level during the next weekly assignment.
        Check back after the next assignment cycle.
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F1117',
    padding: 20,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 14,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: SUBTLE,
    lineHeight: 20,
  },
});
