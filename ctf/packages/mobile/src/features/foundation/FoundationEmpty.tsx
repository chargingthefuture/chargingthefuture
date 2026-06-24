import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const COLOR = '#F59E0B';

/**
 * Foundation empty state — mirrors MobileFoundationEmpty.tsx mockup.
 * Shown when no providers are found for the current query.
 */
export function FoundationEmpty() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {/* Hammer placeholder — uses text glyph since lucide-react-native not available */}
        <Text style={styles.iconText}>&#x1F528;</Text>
      </View>
      <Text style={styles.title}>No listings yet</Text>
      <Text style={styles.desc}>
        Post a service you offer or a job you need done. Paid in ServiceCredits or cash — your choice.
      </Text>
      <View style={[styles.btn, { backgroundColor: COLOR }]}>
        <Text style={styles.btnText}>Post a Service</Text>
      </View>
      <View style={[styles.btn, { backgroundColor: SURFACE, borderColor: BORDER, borderWidth: 1 }]}>
        <Text style={[styles.btnText, { color: TEXT }]}>Get Job Alerts</Text>
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
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 30,
    opacity: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 10,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    color: SUBTLE,
    lineHeight: 22,
    marginBottom: 28,
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
