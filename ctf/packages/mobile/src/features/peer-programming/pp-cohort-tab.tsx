import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import type {
  PeerProgrammingCohort,
  PeerProgrammingCohortSummary,
  PeerProgrammingTopic,
} from './api';

const COLOR = '#6EE7B7';

type Props = {
  cohort: PeerProgrammingCohort | null;
  topic: PeerProgrammingTopic | null;
  cohorts: PeerProgrammingCohortSummary[];
  currentCohortId: string | null;
  myCohortId: string | null;
  onListenIn: (_cohortId: string) => void;
};

export const PeerProgrammingCohortTab = ({
  cohort,
  topic,
  cohorts,
  currentCohortId,
  myCohortId,
  onListenIn,
}: Props) => (
  <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
    <View style={styles.infoBox}>
      <Text style={styles.infoTitle}>Deterministic Placement</Text>
      <Text style={styles.infoDesc}>Every survivor gets placed in a cohort. No one left behind.</Text>
    </View>
    {cohort !== null && (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.cohortLabel}>{cohort.cohortLabel}</Text>
            <Text style={styles.weekText}>Week of {cohort.weekStartDate}</Text>
          </View>
          <View style={[styles.statusBadge, cohort.fallbackOpen ? styles.statusOpen : styles.statusActive]}>
            <Text style={[styles.statusText, cohort.fallbackOpen ? styles.statusOpenText : styles.statusActiveText]}>
              {cohort.fallbackOpen ? '⏳ Open' : '🔴 Active'}
            </Text>
          </View>
        </View>
        {topic !== null && (
          <View style={styles.topicBox}>
            <Text style={styles.topicLabel}>This week's topic</Text>
            <Text style={styles.topicTitle}>{topic.title}</Text>
            {topic.guidance.length > 0 && (
              <Text style={styles.topicGuidance}>{topic.guidance}</Text>
            )}
          </View>
        )}
      </View>
    )}

    {cohorts.length > 0 && (
      <View style={styles.runningSection}>
        <Text style={styles.runningTitle}>Running cohorts this week</Text>
        {cohorts.map((c) => {
          const isCurrent = c.id === currentCohortId;
          const isMine = c.id === myCohortId;
          return (
            <View key={c.id} style={styles.runningRow}>
              <View style={styles.runningLeft}>
                <Text style={styles.runningLabel}>{c.cohortLabel}</Text>
                <Text style={styles.runningMeta}>
                  {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                  {c.fallbackOpen ? ' · open' : ''}
                  {isMine ? ' · yours' : ''}
                </Text>
              </View>
              {isCurrent ? (
                <Text style={styles.runningHere}>Viewing</Text>
              ) : (
                <Pressable style={styles.listenBtn} onPress={() => onListenIn(c.id)}>
                  <Text style={styles.listenBtnText}>Listen in</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    )}
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16 },
  infoBox: {
    backgroundColor: `${COLOR}08`,
    borderColor: `${COLOR}18`,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: COLOR, marginBottom: 4 },
  infoDesc: { fontSize: 12, color: '#6B7280' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: `${COLOR}30`,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardLeft: { flex: 1, marginRight: 8 },
  cohortLabel: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  weekText: { fontSize: 12, color: '#6B7280' },
  statusBadge: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusActive: { backgroundColor: '#22C55E20', borderColor: '#22C55E40' },
  statusOpen: { backgroundColor: `${COLOR}20`, borderColor: `${COLOR}40` },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusActiveText: { color: '#22C55E' },
  statusOpenText: { color: COLOR },
  topicBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  topicLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  topicTitle: { fontSize: 14, fontWeight: '700', color: '#F9FAFB', marginBottom: 6 },
  topicGuidance: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  runningSection: { marginTop: 16 },
  runningTitle: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  runningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 8,
  },
  runningLeft: { flex: 1 },
  runningLabel: { fontSize: 14, fontWeight: '700', color: '#F9FAFB', marginBottom: 2 },
  runningMeta: { fontSize: 11, color: '#6B7280' },
  runningHere: { fontSize: 12, fontWeight: '700', color: COLOR },
  listenBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
  },
  listenBtnText: { fontSize: 12, fontWeight: '700', color: COLOR },
});
