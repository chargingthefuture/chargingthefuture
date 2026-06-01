import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Aligned to design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/MobileTrustTransportLoading.tsx
export const TrustTransportLoadingState: React.FC = () => (
  <View style={styles.root}>
    <View style={styles.center}>
      <Text style={styles.tagline}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.tagline}>EXIT THE PSYOP</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1117', alignItems: 'center', justifyContent: 'center' },
  center: { paddingHorizontal: 32, alignItems: 'center' },
  tagline: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
});
