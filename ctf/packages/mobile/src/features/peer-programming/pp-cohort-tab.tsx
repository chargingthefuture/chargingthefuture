import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import type {
  PeerProgrammingCohort,
  PeerProgrammingCohortMember,
  PeerProgrammingCohortSummary,
  PeerProgrammingTopic,
} from './api';

function memberName(member: PeerProgrammingCohortMember): string {
  return member.username ?? `Member ${member.userId.slice(0, 6)}`;
}

type Props = {
  cohort: PeerProgrammingCohort | null;
  topic: PeerProgrammingTopic | null;
  cohorts: PeerProgrammingCohortSummary[];
  members: PeerProgrammingCohortMember[];
  currentCohortId: string | null;
  myCohortId: string | null;
  onListenIn: (_cohortId: string) => void;
};

export const PeerProgrammingCohortTab = ({
  cohort,
  topic,
  cohorts,
  members,
  currentCohortId,
  myCohortId,
  onListenIn,
}: Props) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
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
        {members.length > 0 && (
          <View style={styles.rosterBox}>
            <Text style={styles.rosterLabel}>In this cohort</Text>
            {members.map((m) => (
              <Text key={m.userId} style={styles.rosterMember}>· {memberName(m)}</Text>
            ))}
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
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16 },
  infoBox: {
    backgroundColor: `${accent}08`,
    borderColor: `${accent}18`,
    borderWidth: 1,
    borderRadius: t.radius,
    padding: 12,
    marginBottom: 14,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: accent, marginBottom: 4 },
  infoDesc: { fontSize: 12, color: t.textSecondary },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: `${accent}30`,
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
  cohortLabel: { fontSize: 16, fontWeight: '700', color: t.textPrimary, marginBottom: 4 },
  weekText: { fontSize: 12, color: t.textSecondary },
  statusBadge: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusActive: { backgroundColor: '#22C55E20', borderColor: '#22C55E40' },
  statusOpen: { backgroundColor: `${accent}20`, borderColor: `${accent}40` },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusActiveText: { color: '#22C55E' },
  statusOpenText: { color: accent },
  topicBox: {
    borderTopWidth: 1,
    borderTopColor: t.borderFaint,
    paddingTop: 12,
  },
  topicLabel: { fontSize: 11, color: t.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  topicTitle: { fontSize: 14, fontWeight: '700', color: t.textPrimary, marginBottom: 6 },
  topicGuidance: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
  rosterBox: {
    borderTopWidth: 1,
    borderTopColor: t.borderFaint,
    paddingTop: 12,
    marginTop: 12,
  },
  rosterLabel: {
    fontSize: 11,
    color: t.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  rosterMember: { fontSize: 13, color: t.textShell, lineHeight: 20 },
  runningSection: { marginTop: 16 },
  runningTitle: {
    fontSize: 11,
    color: t.textSecondary,
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
    borderRadius: t.radius,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 8,
  },
  runningLeft: { flex: 1 },
  runningLabel: { fontSize: 14, fontWeight: '700', color: t.textPrimary, marginBottom: 2 },
  runningMeta: { fontSize: 11, color: t.textSecondary },
  runningHere: { fontSize: 12, fontWeight: '700', color: accent },
  listenBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${accent}15`,
    borderWidth: 1,
    borderColor: `${accent}40`,
  },
  listenBtnText: { fontSize: 12, fontWeight: '700', color: accent },
  });
}
