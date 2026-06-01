import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Design: MobileWorkforceLoading — minimal branded loading state
export function WorkforceLoading() {
  return (
    <View style={styles.container}>
      <Text style={styles.line1}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.line2}>EXIT THE PSYOP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  line1: {
    fontSize: 10,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  line2: {
    fontSize: 10,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
});
