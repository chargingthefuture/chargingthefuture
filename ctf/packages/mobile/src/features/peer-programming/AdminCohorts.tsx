// The weekly topic, the weekly assignment and the cohort list on the PeerProgramming admin screen,
// copied from the web admin (web components/peer-programming/pp-admin-shell.tsx). "Open room →"
// opens that cohort in the member screen, as the web link does with ?cohortId=. Ending a cohort asks
// first, in Android's own dialog where the web uses the browser's.
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { interFamily } from '../../components/ui';
import type { AdminCohort, AdminTopic, AssignmentRunResult, TopicDraft } from './PeerProgrammingAdminApi';
import type { AssignmentInput } from './usePeerProgrammingAdmin';
import { memberName } from './ppChat';
import { AdminAssignments } from './AdminAssignments';
import { AdminSection, EmptyLine, SectionLead, SectionTitle } from './AdminParts';
import { AdminTopicForm } from './AdminTopicForm';
import { usePPTheme } from './usePPTheme';

export function WeeklyTopicSection({ topic, defaultWeekStart, saving, onSubmit }: {
  topic: AdminTopic | null;
  defaultWeekStart: string;
  saving: boolean;
  onSubmit: (_draft: TopicDraft) => Promise<void>;
}) {
  const t = usePPTheme();
  return (
    <AdminSection>
      <View style={styles.topicHead}>
        <SectionTitle text="Weekly topic" marginBottom={0} />
        {topic ? (
          <Text style={[styles.topicLine, { color: t.MUTED }]}>
            Current published topic: <Text style={[styles.strong, { color: t.TITLE }]}>{topic.title}</Text> (week of{' '}
            {topic.weekStartDate}, status {topic.status}).
          </Text>
        ) : (
          <Text style={[styles.topicLine, { color: t.MUTED }]}>No topic is published for the current week. Fill in the form to set one.</Text>
        )}
      </View>
      <AdminTopicForm topic={topic} defaultWeekStart={defaultWeekStart} busy={saving} onSubmit={onSubmit} />
    </AdminSection>
  );
}

export function WeeklyAssignmentSection({ running, lastRun, onRun }: {
  running: boolean;
  lastRun: AssignmentRunResult | null;
  onRun: (_input: AssignmentInput) => Promise<void>;
}) {
  return (
    <AdminSection>
      <SectionTitle text="Weekly cohort assignment" marginBottom={12} />
      <AdminAssignments busy={running} lastResult={lastRun} onRun={onRun} />
    </AdminSection>
  );
}

function StatusBadge({ cohort }: { cohort: AdminCohort }) {
  const t = usePPTheme();
  const look = cohort.status === 'ended'
    ? { text: 'Ended', background: 'rgba(107,114,128,0.18)', color: t.MUTED, border: t.BORDER_SOLID }
    : cohort.fallbackOpen
      ? { text: 'Open', background: 'rgba(234,179,8,0.15)', color: '#EAB308', border: 'rgba(234,179,8,0.3)' }
      : null;
  if (!look) return null;
  return (
    <View style={[styles.badge, { borderRadius: t.r(10), backgroundColor: look.background, borderColor: look.border }]}>
      <Text style={[styles.badgeText, { color: look.color }]}>{look.text}</Text>
    </View>
  );
}

function EndButton({ cohort, ending, onEnd }: { cohort: AdminCohort; ending: boolean; onEnd: (_cohortId: string) => void }) {
  const t = usePPTheme();
  const confirm = () =>
    Alert.alert(
      '',
      `End Cohort ${cohort.cohortLabel}? Members can still read the conversation, but no one will be able to post. This cannot be undone here.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', onPress: () => onEnd(cohort.id) }],
    );
  return (
    <TouchableOpacity onPress={confirm} disabled={ending} accessibilityRole="button" style={[styles.end, { borderRadius: t.r(8), opacity: ending ? 0.7 : 1 }]}>
      <Text style={styles.endText}>{ending ? 'Ending…' : 'End cohort'}</Text>
    </TouchableOpacity>
  );
}

function CohortRow({ cohort, endingCohortId, onEnd, onOpenRoom }: {
  cohort: AdminCohort;
  endingCohortId: string | null;
  onEnd: (_cohortId: string) => void;
  onOpenRoom: (_cohortId: string) => void;
}) {
  const t = usePPTheme();
  const members = cohort.members ?? [];
  return (
    <View style={[styles.row, { borderRadius: t.r(10), backgroundColor: t.HEADER, borderColor: t.BORDER_SOLID }]}>
      <View style={styles.rowText}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: t.TITLE }]}>Cohort {cohort.cohortLabel}</Text>
          <StatusBadge cohort={cohort} />
        </View>
        <Text style={[styles.meta, { color: t.MUTED }]}>
          Week of {cohort.weekStartDate} · {cohort.memberCount} member{cohort.memberCount !== 1 ? 's' : ''}
        </Text>
        {members.length > 0 ? <Text style={styles.members}>Members: {members.map(memberName).join(', ')}</Text> : null}
      </View>
      <View style={styles.rowActions}>
        {cohort.status === 'active' && !cohort.isStanding ? (
          <EndButton cohort={cohort} ending={endingCohortId === cohort.id} onEnd={onEnd} />
        ) : null}
        <TouchableOpacity onPress={() => onOpenRoom(cohort.id)} accessibilityRole="link">
          <Text style={[styles.open, { color: t.ACCENT }]}>Open room →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function CohortsSection({ cohorts, endingCohortId, onEnd, onOpenRoom }: {
  cohorts: AdminCohort[];
  endingCohortId: string | null;
  onEnd: (_cohortId: string) => void;
  onOpenRoom: (_cohortId: string) => void;
}) {
  return (
    <AdminSection>
      <SectionTitle text="Cohorts" />
      <SectionLead>
        Every cohort you have formed, most recent first. Open any one to read along and manage it — you are included in
        all of them.
      </SectionLead>
      {cohorts.length === 0 ? (
        <EmptyLine text="No cohorts have formed yet. Run the weekly assignment above to form them." />
      ) : (
        <View style={styles.list}>
          {cohorts.map((cohort) => (
            <CohortRow key={cohort.id} cohort={cohort} endingCohortId={endingCohortId} onEnd={onEnd} onOpenRoom={onOpenRoom} />
          ))}
        </View>
      )}
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  topicHead: { marginBottom: 12 },
  topicLine: { fontSize: 12, marginTop: 6, lineHeight: 18, fontFamily: interFamily('400') },
  strong: { fontFamily: interFamily('600') },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  rowText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontFamily: interFamily('700') },
  badge: { paddingVertical: 1, paddingHorizontal: 7, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: interFamily('400') },
  meta: { fontSize: 12, marginTop: 2, fontFamily: interFamily('400') },
  members: { fontSize: 12, color: '#D1D5DB', marginTop: 4, fontFamily: interFamily('400') },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  end: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.12)' },
  endText: { fontSize: 12, color: '#EF4444', fontFamily: interFamily('700') },
  open: { fontSize: 12, fontFamily: interFamily('700') },
});
