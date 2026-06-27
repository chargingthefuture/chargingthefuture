import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { logIncident, fetchIncidents } from './api';

export function ClickLogCounter() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIncidents();
      setCount(data.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refresh();
  }, []);

  const handleLogIncident = async () => {
    setLoading(true);
    setError(null);
    try {
      let location = null;
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        location = await Location.getCurrentPositionAsync({});
      }
      await logIncident({
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
      });
      // Fire-and-forget haptic feedback (non-critical)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text
        style={{ fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}
        accessibilityLabel="Incidents logged count"
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
      >
        {count}
      </Text>
      <Text
        style={{ fontSize: 18, marginBottom: 16 }}
        accessibilityLabel="Incidents logged label"
        accessibilityRole="text"
      >
        Incidents logged
      </Text>
      <Button
        title="Log Incident"
        onPress={handleLogIncident}
        disabled={loading}
        accessibilityLabel="Log incident"
      />
      {loading && (
        <ActivityIndicator
          style={{ marginTop: 16 }}
          accessible={true}
          accessibilityLabel="Logging in progress"
        />
      )}
      {error && (
        <Text
          style={{ color: 'red', marginTop: 8 }}
          accessibilityLabel="Error message"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
