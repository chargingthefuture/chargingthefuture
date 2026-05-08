import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

export const Unlock = () => {
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!url.match(/^https:\/\/(www\.)?quora\.com\/profile\//)) {
      setError('Please enter a valid Quora profile URL.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/unlock/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoraProfileUrl: url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Submission failed. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Submission Received</Text>
        <Text style={styles.text}>Your Quora profile is under review. You will be notified when your access is upgraded.</Text>
        <Text style={styles.incentive}>You will be awarded <Text style={styles.bold}>100 Service Credits</Text> upon approval!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock Access</Text>
      <Text style={styles.text}>To unlock full access, please submit your Quora profile URL for trust verification.</Text>
      <Text style={styles.incentive}>Get 100 Service Credits upon approval!</Text>
      <TextInput
        style={styles.input}
        placeholder="https://www.quora.com/profile/Your-Name"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color="#0000ff" />
      ) : (
        <Button title="Submit" onPress={handleSubmit} disabled={loading} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  text: { fontSize: 16, marginBottom: 8 },
  incentive: { fontSize: 16, color: 'green', fontWeight: '600', marginBottom: 12 },
  bold: { fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 10 },
  error: { color: 'red', marginBottom: 8 },
});
