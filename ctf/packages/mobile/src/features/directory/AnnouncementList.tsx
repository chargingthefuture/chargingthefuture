// Directory announcements (mobile). Real data only: binds to
// GET /api/directory/announcements via the shared authenticated client.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import type { DirectoryAnnouncement } from './api';
import { fetchDirectoryAnnouncements } from './api';

export const AnnouncementList = () => {
  const [items, setItems] = useState<DirectoryAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const announcements = await fetchDirectoryAnnouncements();
      setItems(announcements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateText}>Loading announcements…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateText}>Could not load announcements.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Announcements</Text>
      {items.length === 0 ? (
        <Text style={styles.stateText}>No announcements yet.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.annTitle}>{item.title}</Text>
              <Text style={styles.annBody}>{item.body}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateText: { color: '#666', textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  annTitle: { fontWeight: '600' },
  annBody: { color: '#444', marginTop: 4 },
  retryBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  retryText: { fontWeight: '600' },
});
