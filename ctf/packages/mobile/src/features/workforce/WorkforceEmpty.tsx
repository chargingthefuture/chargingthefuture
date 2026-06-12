import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Design: MobileWorkforceEmpty — no skills/profile listed yet
// "Add Skills" and "View Demand Map" CTAs have no mobile API backing → layout preserved, buttons inert
const COLOR = '#F97316';

export function WorkforceEmpty() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workforce</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>≡</Text>
        </View>
        <Text style={styles.title}>No skills listed yet</Text>
        <Text style={styles.subtitle}>
          Add your verified skills to appear in workforce demand data and get matched to opportunities.
        </Text>
        {/* Add Skills / View Demand Map actions have no mobile route yet — omitted per real-data-only rule */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  header: {
    backgroundColor: '#090B0F',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2A3A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
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
    color: `${COLOR}50`,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    textAlign: 'center',
  },
});
