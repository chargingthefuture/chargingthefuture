
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform } from 'react-native';
import type { SocketRequest } from './types';

const COLOR = '#F43F5E';

// API endpoints (update if needed)
const API_BASE = '/api/socketrelay';

export function SocketRelay() {
  const [tab, setTab] = useState<'feed' | 'post' | 'chat'>('feed');
  const [requests, setRequests] = useState<SocketRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  // const [postType, setPostType] = useState<'need' | 'offer'>('need');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [posting, setPosting] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (tab === 'feed') {
      setLoading(true);
      fetch(`${API_BASE}/requests`)
        .then(res => res.json())
        .then(data => {
          setRequests(data.items || []);
          setEmpty((data.items || []).length === 0);
          setError(null);
        })
        .catch(() => setError('Failed to load requests.'))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const handlePost = async () => {
    if (!input.trim() || !category.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.slice(0, 80),
          details: input,
          category,
          city: location,
          isPublic: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to post');
      setInput('');
      setCategory('');
      setLocation('');
      setTab('feed');
    } catch {
      setError('Failed to post request.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
{['feed', 'post', 'chat'].map((t) => (
  <TouchableOpacity key={t} onPress={() => setTab(t as 'feed' | 'post' | 'chat')} style={[styles.tab, tab === t && styles.tabActive]}>
    <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
  </TouchableOpacity>
))}
      </View>
      {tab === 'feed' && (
        loading ? <ActivityIndicator color={COLOR} style={{ marginTop: 32 }} /> :
        error ? <Text style={styles.error}>{error}</Text> :
        empty ? <Text style={styles.empty}>No requests yet. Be the first to post!</Text> :
        <ScrollView style={{ flex: 1 }}>
          {requests.map((r) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.cardMeta}>{r.category} · {r.city || 'Unknown'}</Text>
              <Text style={styles.cardDetails}>{r.details}</Text>
            </View>
          ))}
        </ScrollView>
      )}
      {tab === 'post' && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="What do you need or offer?"
            value={input}
            onChangeText={setInput}
            multiline
            numberOfLines={3}
          />
          <TextInput
            style={styles.input}
            placeholder="Category (Food, Transport, Legal…)"
            value={category}
            onChangeText={setCategory}
          />
          <TextInput
            style={styles.input}
            placeholder="Location (optional)"
            value={location}
            onChangeText={setLocation}
          />
          <TouchableOpacity style={styles.button} onPress={handlePost} disabled={posting}>
            <Text style={styles.buttonText}>{posting ? 'Posting…' : 'Post'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {tab === 'chat' && (
        <SocketRelayStreamTab />
      )}
    import { SocketRelayStreamTab } from './SocketRelayStreamTab';
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1117', paddingTop: Platform.OS === 'android' ? 32 : 0 },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#090B0F', paddingVertical: 12 },
  tab: { padding: 8, borderRadius: 8 },
  tabActive: { backgroundColor: '#F43F5E20' },
  tabText: { color: '#6B7280', fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: COLOR },
  card: { backgroundColor: '#181B23', borderRadius: 12, padding: 16, margin: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#F43F5E', marginBottom: 6 },
  cardDetails: { fontSize: 13, color: '#E8EAF0' },
  form: { padding: 16 },
  input: { backgroundColor: '#181B23', color: '#E8EAF0', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 },
  button: { backgroundColor: COLOR, borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  error: { color: '#F43F5E', textAlign: 'center', marginTop: 32 },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 32, fontSize: 16 },
});
