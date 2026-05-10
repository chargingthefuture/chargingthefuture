

import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Button } from 'react-native';

// Placeholder generic auth context
const AuthContext = React.createContext({ isAuthenticated: false, signIn: () => {} });

type Profile = {
  name: string;
  role: string;
  skills: string[];
  region: string;
  status: string;
};


export function WorkforceProfile() {
  const auth = useContext(AuthContext);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Replace with real API call
    setTimeout(() => {
      setProfile(null);
      setLoading(false);
    }, 1000);
  }, []);

  if (!auth.isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Sign in required</Text>
        <Text style={styles.empty}>Please sign in to view your Workforce profile.</Text>
        <Button title="Sign In" onPress={auth.signIn} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}><ActivityIndicator size="large" color="#6366F1" /></View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}><Text style={styles.error}>{error}</Text></View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>My Workforce Profile</Text>
        <Text style={styles.empty}>No profile data found. Complete your profile to get started.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Workforce Profile</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Name:</Text>
        <Text style={styles.value}>{profile.name}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Role:</Text>
        <Text style={styles.value}>{profile.role}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Skills:</Text>
        <Text style={styles.value}>{profile.skills.join(', ')}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Region:</Text>
        <Text style={styles.value}>{profile.region}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Status:</Text>
        <Text style={styles.value}>{profile.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1117', padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#E8EAF0', marginBottom: 20 },
  section: { marginBottom: 14 },
  label: { fontSize: 16, color: '#6366F1', fontWeight: '600' },
  value: { fontSize: 16, color: '#E8EAF0', marginLeft: 8 },
  empty: { fontSize: 16, color: '#9CA3AF', marginTop: 24 },
  error: { fontSize: 16, color: '#EF4444', marginTop: 24 },
});
