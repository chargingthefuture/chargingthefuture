import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import { WorkforceProfileCard } from './WorkforceProfileCard';
import { fetchWorkforceProfile } from './api';
import type { WorkforceProfileData } from './api';

// Standalone "My Workforce Profile" screen.
// Binds to GET /api/workforce/profile through the shared authedFetch wrapper
// (Clerk bearer token attached) and renders only fields the API returns
// (occupationName, skillLevel, region, recruitedState) via WorkforceProfileCard.
// The profile is a read-only Directory-derived view; there is no editor.
const COLOR = '#F97316';

export function WorkforceProfile() {
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [profile, setProfile] = useState<WorkforceProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWorkforceProfile();
      setProfile(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load workforce profile');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  if (authLoading || (auth?.isAuthenticated && loading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR} />
      </View>
    );
  }

  if (!auth?.isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>My Workforce Profile</Text>
        <Text style={styles.empty}>Sign in to view your Workforce profile.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>My Workforce Profile</Text>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>My Workforce Profile</Text>
        <Text style={styles.empty}>
          No workforce profile yet. Complete your Directory profile to appear in workforce data.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <WorkforceProfileCard profile={profile} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0F1117' },
  scrollContent: { padding: 16 },
  container: { flex: 1, backgroundColor: '#0F1117', padding: 16 },
  center: {
    flex: 1,
    backgroundColor: '#0F1117',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: { fontSize: 24, fontWeight: 'bold', color: '#E8EAF0', marginBottom: 20 },
  empty: { fontSize: 16, color: '#9CA3AF', marginTop: 24, lineHeight: 24 },
  error: { fontSize: 16, color: '#EF4444', marginTop: 24 },
});
