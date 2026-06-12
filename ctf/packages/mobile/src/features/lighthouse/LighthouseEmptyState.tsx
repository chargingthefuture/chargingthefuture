import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLOR = '#60A5FA';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const SUBTLE = '#6B7280';

export const LighthouseEmptyState: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.iconCircle}>
      <Ionicons name="home-outline" size={30} color={`${COLOR}80`} />
    </View>
    <Text style={styles.heading}>No listings match</Text>
    <Text style={styles.body}>
      Check back soon for safe, verified housing near you.
    </Text>
    <View style={styles.privacyBadge}>
      <Ionicons name="shield-checkmark-outline" size={13} color={COLOR} />
      <Text style={styles.privacyText}>Location is never stored</Text>
    </View>
    <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.8}>
      <Ionicons name="search-outline" size={16} color="#000" />
      <Text style={styles.primaryBtnText}>Adjust Filters</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8}>
      <Ionicons name="notifications-outline" size={16} color="#F9FAFB" />
      <Text style={styles.secondaryBtnText}>Alert Me</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: SUBTLE,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${COLOR}10`,
    borderWidth: 1,
    borderColor: `${COLOR}20`,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  privacyText: {
    fontSize: 12,
    color: SUBTLE,
    marginLeft: 4,
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginLeft: 4,
  },
  secondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 14,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F9FAFB',
    marginLeft: 4,
  },
});
