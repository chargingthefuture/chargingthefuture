import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BG = '#0F1117';
const TEXT_DIM = 'rgba(255,255,255,0.22)';

/**
 * Foundation loading state — mirrors MobileFoundationLoading.tsx mockup.
 * Centered brand messaging while data is fetched.
 */
export function FoundationLoading() {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.line}>EXIT THEIR ECONOMY</Text>
        <Text style={styles.line}>EXIT THE PSYOP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  line: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: TEXT_DIM,
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
});
