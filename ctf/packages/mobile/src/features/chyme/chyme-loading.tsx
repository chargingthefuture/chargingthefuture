import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const ChymeLoading: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.line1}>EXIT THEIR ECONOMY</Text>
    <Text style={styles.line2}>EXIT THE PSYOP</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1117',
    paddingHorizontal: 32,
  },
  line1: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  line2: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
});
