
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Switch, Alert } from 'react-native';
import { Trust } from '../trust';
import type { Profile } from './types';

export const DirectoryProfile = ({ profile }: { profile?: Profile }) => {
  const p = profile ?? { id: 'p1', name: 'Alice', title: 'Engineer', isPublic: true, description: 'Mobile-first engineer' };
  const [isPublic, setIsPublic] = useState<boolean>(p.isPublic);

  const togglePublic = () => {
    setIsPublic(v => !v);
    Alert.alert('Profile visibility', `Profile is now ${!isPublic ? 'Public' : 'Private'} (mock)`);
  };

  const handleCopyPublicUrl = () => {
    // In real app would copy to clipboard; mocked here
    Alert.alert('Public URL', `https://example.com/directory/${p.id} (mock)`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{p.name}</Text>
      <Text style={styles.title}>{p.title}</Text>
      <Text style={styles.desc}>{p.description}</Text>

      {/* Trust Panel (Android parity) */}
      <Trust compact />

      <View style={styles.row}>
        <Text>Public profile</Text>
        <Switch value={isPublic} onValueChange={togglePublic} />
      </View>

      <View style={styles.actions}>
        <Button title="Copy public URL" onPress={handleCopyPublicUrl} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12 },
  name: { fontSize: 20, fontWeight: '700' },
  title: { color: '#666', marginBottom: 8 },
  desc: { marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-start' },
});
