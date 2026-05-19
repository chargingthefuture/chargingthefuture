import React from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert } from 'react-native';

const mockProfiles = [
  { id: 'p1', name: 'Alice', title: 'Engineer' },
  { id: 'p2', name: 'Bob', title: 'Designer' },
  { id: 'p3', name: 'Carol', title: 'PM' },
];

export const DirectoryList = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Directory (mock)</Text>
      <FlatList
        data={mockProfiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.titleText}>{item.title}</Text>
            </View>
            <Button title="View" onPress={() => Alert.alert('Profile', `${item.name} (${item.title})`)} />
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
});
