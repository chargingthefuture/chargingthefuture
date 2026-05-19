import React from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert } from 'react-native';

const mockProfiles = [
  { id: 'p1', name: 'Alice', title: 'Engineer' },
  { id: 'p2', name: 'Bob', title: 'Designer' },
  { id: 'p3', name: 'Carol', title: 'PM' },
];

export const AdminDirectory = () => {
  const handleCreate = () => Alert.alert('Create profile', 'Mock create flow');
  const handleEdit = (id: string) => Alert.alert('Edit profile', `Mock edit for ${id}`);
  const handleDelete = (id: string) => Alert.alert('Delete profile', `Mock delete for ${id}`);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Directory Admin (mock)</Text>
      <Button title="Create Profile" onPress={handleCreate} />

      <FlatList
        data={mockProfiles}
        keyExtractor={(item) => item.id}
        style={{ marginTop: 12 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.titleText}>{item.title}</Text>
            </View>
            <View style={styles.actions}>
              <Button title="Edit" onPress={() => handleEdit(item.id)} />
              <Button title="Delete" onPress={() => handleDelete(item.id)} />
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  name: { fontWeight: '600' },
  titleText: { color: '#666' },
  actions: { flexDirection: 'row', gap: 8 },
});
