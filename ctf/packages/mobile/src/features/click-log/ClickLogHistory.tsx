import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Button, ActivityIndicator, Alert } from 'react-native';
import { fetchIncidents, deleteIncident } from './api';

type Incident = {
  id: string;
  created_at: string;
  metadata?: {
    latitude?: number;
    longitude?: number;
    notes?: string;
  };
};

export function ClickLogHistory() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIncidents();
      setIncidents(data.incidents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Incident',
      'Are you sure you want to delete this incident?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              await deleteIncident(id);
              await refresh();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              setError(msg);
              Alert.alert('Error', msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {loading && <ActivityIndicator />}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 32 }}>No incidents logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={{ borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 12, color: '#888' }}>{new Date(item.created_at).toLocaleString()}</Text>
              {item.metadata?.latitude && item.metadata?.longitude && (
                <Text style={{ fontSize: 12 }}>Location: {item.metadata.latitude.toFixed(4)}, {item.metadata.longitude.toFixed(4)}</Text>
              )}
              {item.metadata?.notes && (
                <Text style={{ fontSize: 12, fontStyle: 'italic' }}>{item.metadata.notes}</Text>
              )}
            </View>
            <Button title="Delete" onPress={() => handleDelete(item.id)} />
          </View>
        )}
      />
    </View>
  );
}
