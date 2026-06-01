
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trust } from '../trust';
import type { Profile } from './types';

export const DirectoryProfile = ({ profile }: { profile?: Profile }) => {
  const p = profile ?? { id: 'p1', name: 'Alice', title: 'Engineer', description: 'Mobile-first engineer' };

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{p.name}</Text>
      <Text style={styles.title}>{p.title}</Text>
      <Text style={styles.desc}>{p.description}</Text>

      {/* Trust Panel (Android parity) */}
      <Trust />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12 },
  name: { fontSize: 20, fontWeight: '700' },
  title: { color: '#666', marginBottom: 8 },
  desc: { marginBottom: 12 },
});
