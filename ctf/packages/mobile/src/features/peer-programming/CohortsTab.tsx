// The Cohorts tab, copied from the web's PeerProgrammingCohortsTab (web components/peer-programming/
// pp-cohorts-tab.tsx): the "Weekly Global Masterminds" heading, the member's cohort card (or the
// not-yet-assigned card), the open cohort's members, the other running cohorts to listen in on, and
// the feedback box once the member's own cohort has ended.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import type { Room } from './PeerProgrammingApi';
import { memberName } from './ppChat';
import { FeedbackForm } from './FeedbackForm';
import { PPHero } from './PPHero';
import { RunningCohorts } from './RunningCohorts';
import { usePPTheme } from './usePPTheme';

function NotAssigned() {
  const t = usePPTheme();
  return (
    <View style={[styles.notAssigned, { borderRadius: t.r(16), borderColor: t.BORDER, backgroundColor: t.CARD_BG }]}>
      <Users size={40} color={t.ACCENT} style={styles.faded} />
      <Text style={[styles.notAssignedTitle, { color: t.TEXT }]}>Not yet assigned to a cohort</Text>
      <Text style={[styles.notAssignedText, { color: t.MUTED }]}>
        Assignments happen every Monday. Until then you can listen in on any running cohort below.
      </Text>
    </View>
  );
}

function AssignedCohort({ room, memberCount, onJoin }: { room: Room; memberCount: number; onJoin: () => void }) {
  const t = usePPTheme();
  const badge = room.ended ? { text: 'Ended', color: '#94A3B8' } : { text: 'Active', color: '#22C55E' };
  const name = room.cohort?.cohortLabel || `Cohort ${room.cohort?.id ?? ''}`;
  return (
    <View style={[styles.assigned, { borderRadius: t.r(16), borderColor: `${t.ACCENT}30`, backgroundColor: t.CARD_BG }]}>
      <View style={styles.assignedText}>
        <View style={styles.nameRow}>
          <Text style={[styles.cohortName, { color: t.TITLE }]}>{name}</Text>
          <View style={[styles.badge, { borderRadius: t.r(12), backgroundColor: `${badge.color}20`, borderColor: `${badge.color}40` }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>
        {room.topic?.title ? <Text style={[styles.topic, { color: t.SUBTLE }]}>Topic: {room.topic.title}</Text> : null}
        <Text style={[styles.count, { color: t.MUTED }]}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
      </View>
      {room.ended ? null : (
        <TouchableOpacity onPress={onJoin} accessibilityRole="button" style={[styles.join, { borderRadius: t.r(10), backgroundColor: t.ACCENT }]}>
          <Text style={styles.joinText}>Join Session</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Roster({ room }: { room: Room }) {
  const t = usePPTheme();
  if (room.members.length === 0) return null;
  return (
    <View style={[styles.roster, { borderRadius: t.r(12), borderColor: t.BORDER, backgroundColor: t.CARD_BG }]}>
      <Text style={[styles.rosterTitle, { color: t.MUTED }]}>In this cohort</Text>
      <View style={styles.chips}>
        {room.members.map((member) => (
          <Text key={member.userId} style={[styles.chip, { color: t.TEXT, backgroundColor: t.INPUT_BG, borderColor: t.BORDER_STRONG, borderRadius: t.r(8) }]}>
            {memberName(member)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function CohortsTab({ room, openCohortId, switching, isAdmin, onOpenCohort, onJoinSession }: {
  room: Room;
  openCohortId: string | null;
  switching: boolean;
  isAdmin: boolean;
  onOpenCohort: (_cohortId: string) => void;
  onJoinSession: () => void;
}) {
  // The true member count of the member's own cohort; the roster is capped for display.
  const myCount = room.cohorts.find((cohort) => cohort.id === room.myCohortId)?.memberCount ?? room.members.length;
  // Feedback is about a cohort that is over, and only the member's own.
  const showFeedback = Boolean(room.ended && room.cohort && room.cohort.id === room.myCohortId);
  return (
    <View style={styles.pad}>
      <PPHero
        id="ppCohortsHero"
        title="Weekly Global Masterminds"
        line="Active members get placed each week — sign in during the week and you're in a cohort. No competitive selection."
      />
      <View style={styles.stack}>
        {!room.myCohortId ? <NotAssigned /> : room.cohort ? <AssignedCohort room={room} memberCount={myCount} onJoin={onJoinSession} /> : null}
        <Roster room={room} />
        <RunningCohorts
          cohorts={room.cohorts}
          myCohortId={room.myCohortId}
          openCohortId={openCohortId}
          busy={switching}
          isAdmin={isAdmin}
          onOpenCohort={onOpenCohort}
        />
        {showFeedback ? <FeedbackForm cohortId={room.cohort?.id ?? null} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 24 },
  stack: { gap: 14 },
  faded: { opacity: 0.5, marginBottom: 12 },
  notAssigned: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, borderWidth: 1 },
  notAssignedTitle: { fontSize: 16, fontFamily: interFamily('600'), marginBottom: 8, textAlign: 'center' },
  notAssignedText: { fontSize: 14, fontFamily: interFamily('400'), textAlign: 'center' },
  assigned: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 20, paddingHorizontal: 24, borderWidth: 1 },
  assignedText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cohortName: { fontSize: 16, fontFamily: interFamily('700'), flexShrink: 1 },
  badge: { paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: interFamily('400') },
  topic: { fontSize: 13, fontFamily: interFamily('400'), marginBottom: 10 },
  count: { fontSize: 12, fontFamily: interFamily('400') },
  join: { paddingVertical: 10, paddingHorizontal: 20 },
  joinText: { color: '#fff', fontSize: 13, fontFamily: interFamily('700') },
  roster: { paddingVertical: 14, paddingHorizontal: 18, borderWidth: 1 },
  rosterTitle: { fontSize: 11, fontFamily: interFamily('700'), textTransform: 'uppercase', letterSpacing: 0.66, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { fontSize: 13, fontFamily: interFamily('400'), paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, overflow: 'hidden' },
});
