// PeerProgramming admin screen, copied from the web's /admin/peer-programming
// (web components/peer-programming/pp-admin-shell.tsx). The app header above carries the web
// header: back, the code icon, "PeerProgramming Admin" and the Member view pill. Under it: the
// heading card, the error or notice banner, then the feedback inbox, the single standing Cohort 1
// switch, the weekly topic, the weekly assignment and every cohort. App.tsx opens it for admins only;
// the routes check it again.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Code2 } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { HeaderPill, useHeaderActions } from '../../components/shell/HeaderActions';
import { Banner } from './AdminParts';
import { CohortsSection, WeeklyAssignmentSection, WeeklyTopicSection } from './AdminCohorts';
import { FeedbackSection, SingleOpenCohortSection } from './AdminSections';
import { usePeerProgrammingAdmin } from './usePeerProgrammingAdmin';
import { usePPTheme } from './usePPTheme';

// Monday (UTC) of the current week, the week the room reads.
function currentWeekStartDate(now = new Date()): string {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = current.getUTCDay();
  current.setUTCDate(current.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return current.toISOString().slice(0, 10);
}

function HeaderCard() {
  const t = usePPTheme();
  return (
    <View style={[styles.headerCard, { borderRadius: t.r(12), backgroundColor: t.HEADER, borderColor: t.BORDER_SOLID }]}>
      <View style={[styles.headerIcon, { borderRadius: t.r(9), backgroundColor: `${t.ACCENT}20`, borderColor: `${t.ACCENT}35` }]}>
        <Code2 size={18} color={t.ACCENT} />
      </View>
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: t.TITLE }]}>PeerProgramming Admin</Text>
        <Text style={[styles.headerLine, { color: t.MUTED }]}>Weekly topic & cohort assignment</Text>
      </View>
      <View style={[styles.adminTag, { borderRadius: t.r(6) }]}>
        <Text style={styles.adminTagText}>ADMIN</Text>
      </View>
    </View>
  );
}

export function PeerProgrammingAdmin({ onOpenMember, onOpenRoom }: { onOpenMember: () => void; onOpenRoom: (_cohortId: string) => void }) {
  const t = usePPTheme();
  const defaultWeekStart = useMemo(() => currentWeekStartDate(), []);
  const admin = usePeerProgrammingAdmin();

  useHeaderActions(
    <HeaderPill label="Member view" accent={t.ACCENT} accessibilityLabel="Open the member view" onPress={onOpenMember} />,
    [t.ACCENT, onOpenMember],
  );

  return (
    <View style={[styles.root, { backgroundColor: t.BG }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <HeaderCard />
        {admin.error ? <Banner tone="error" spaced>{admin.error}</Banner> : null}
        {admin.notice ? <Banner tone="notice" spaced>{admin.notice}</Banner> : null}
        {admin.loading ? (
          <Text style={[styles.loading, { color: t.MUTED }]}>Loading…</Text>
        ) : (
          <>
            <FeedbackSection feedback={admin.feedback} />
            <SingleOpenCohortSection mode={admin.mode} saving={admin.savingMode} onSet={(enabled) => void admin.setSingleOpenCohort(enabled)} />
            <WeeklyTopicSection topic={admin.topic} defaultWeekStart={defaultWeekStart} saving={admin.savingTopic} onSubmit={admin.submitTopic} />
            <WeeklyAssignmentSection running={admin.runningAssignment} lastRun={admin.lastRun} onRun={admin.runAssignment} />
            <CohortsSection
              cohorts={admin.cohorts}
              endingCohortId={admin.endingCohortId}
              onEnd={(cohortId) => void admin.endCohort(cohortId)}
              onOpenRoom={onOpenRoom}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The app frame pads every screen (12 at the sides, 10 on top); the web admin page runs edge to
  // edge under its header, so this screen takes that padding back.
  root: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  content: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 48 },
  headerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, marginBottom: 16 },
  headerIcon: { width: 36, height: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: interFamily('800') },
  headerLine: { fontSize: 12, fontFamily: interFamily('400') },
  adminTag: { paddingVertical: 3, paddingHorizontal: 9, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.15)' },
  adminTagText: { fontSize: 11, color: '#6366F1', fontFamily: interFamily('700') },
  loading: { paddingVertical: 32, paddingHorizontal: 16, textAlign: 'center', fontSize: 14, fontFamily: interFamily('400') },
});
