import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PRIMARY = '#22C55E';

type Props = {
  onStartRoom: () => void;
};

export const ChymeEmpty: React.FC<Props> = ({ onStartRoom }) => (
  <View style={styles.container}>
    <View style={styles.statusBar}>
      <Text style={styles.clock}>9:41</Text>
      <Text style={styles.signal}>●●●</Text>
    </View>

    <View style={styles.header}>
      <Text style={styles.headerTitle}>Chyme</Text>
    </View>

    <View style={styles.body}>
      <View style={styles.iconRing}>
        {/* Radio icon placeholder — no backing field for icon asset */}
        <Text style={styles.iconGlyph}>📻</Text>
      </View>
      <Text style={styles.title}>No rooms live yet</Text>
      <Text style={styles.subtitle}>
        Be the first to start a room. Topics can be healing, skills, or anything your community needs.
      </Text>
      {/* Start Room: backed by POST /api/chyme/join */}
      <TouchableOpacity style={styles.primaryBtn} onPress={onStartRoom}>
        <Text style={styles.primaryBtnText}>+ Start a Room</Text>
      </TouchableOpacity>
      {/* Schedule: no backend endpoint for scheduling yet — omitted as interactive action */}
      <View style={styles.scheduleBtn}>
        <Text style={styles.scheduleBtnText}>Schedule for Later</Text>
      </View>
    </View>

    <View style={styles.footer}>
      <Text style={styles.footerText}>
        🎤  Rooms are end-to-end encrypted and Safe Space verified
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1117' },
  statusBar: {
    backgroundColor: '#090B0F',
    paddingTop: 12,
    paddingBottom: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clock: { fontSize: 13, fontWeight: '600', color: '#F9FAFB' },
  signal: { fontSize: 11, color: '#6B7280' },
  header: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2A3A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#F9FAFB' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 1,
    borderColor: `${PRIMARY}40`,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconGlyph: { fontSize: 28 },
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
    marginBottom: 28,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  scheduleBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#161B27',
    borderWidth: 1,
    borderColor: '#1E2A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleBtnText: { color: '#F9FAFB', fontWeight: '600', fontSize: 15 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E2A3A',
    backgroundColor: '#161B27',
  },
  footerText: { fontSize: 12, color: '#6B7280' },
});
