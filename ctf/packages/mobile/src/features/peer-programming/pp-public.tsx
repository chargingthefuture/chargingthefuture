import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLOR = '#6EE7B7';

export const PeerProgrammingPublic = () => (
  <View style={styles.root}>
    <Text style={styles.title}>Peer Programming</Text>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>Deterministic global cohorts</Text>
    </View>
    <Text style={styles.description}>
      Weekly cohorts across countries. You are always placed — no competitive selection, guaranteed spot.
    </Text>
    <View style={styles.hint}>
      <Text style={styles.hintText}>Sign in to get matched with your cohort.</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F1117',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    color: COLOR,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 22,
    marginBottom: 20,
  },
  hint: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: `${COLOR}08`,
    borderWidth: 1,
    borderColor: `${COLOR}20`,
  },
  hintText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F9FAFB',
    textAlign: 'center',
  },
});
