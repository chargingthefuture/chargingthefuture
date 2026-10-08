// "Other running cohorts", copied from the web's RunningCohorts (web components/peer-programming/
// pp-cohorts-tab.tsx): every cohort running this week except the member's own, each with a Listen in
// button that opens it read-only, or "Viewing" on the one open now. Hidden when there are no others.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Headphones } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import type { RoomCohort } from './PeerProgrammingApi';
import { usePPTheme } from './usePPTheme';

function CohortRow({ cohort, isOpen, busy, onOpen }: { cohort: RoomCohort; isOpen: boolean; busy: boolean; onOpen: () => void }) {
  const t = usePPTheme();
  const count = `${cohort.memberCount} member${cohort.memberCount !== 1 ? 's' : ''}`;
  return (
    <View
      style={[styles.row, {
        borderRadius: t.r(12),
        backgroundColor: isOpen ? `${t.ACCENT}12` : t.CARD_BG,
        borderColor: isOpen ? `${t.ACCENT}40` : t.BORDER,
      }]}
    >
      <View style={styles.rowText}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: t.TITLE }]}>Cohort {cohort.cohortLabel}</Text>
          {cohort.fallbackOpen ? (
            <View style={[styles.openBadge, { borderRadius: t.r(10) }]}>
              <Text style={styles.openText}>Open</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.count, { color: t.MUTED }]}>{count}</Text>
      </View>
      <TouchableOpacity
        onPress={onOpen}
        disabled={busy || isOpen}
        accessibilityRole="button"
        style={[styles.listen, {
          borderRadius: t.r(8),
          backgroundColor: isOpen ? t.BORDER : `${t.ACCENT}1A`,
          borderColor: isOpen ? t.BORDER_HI : `${t.ACCENT}40`,
        }]}
      >
        <Headphones size={13} color={isOpen ? t.MUTED : t.ACCENT} />
        <Text style={[styles.listenText, { color: isOpen ? t.MUTED : t.ACCENT }]}>{isOpen ? 'Viewing' : 'Listen in'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function RunningCohorts({ cohorts, myCohortId, openCohortId, busy, isAdmin, onOpenCohort }: {
  cohorts: RoomCohort[];
  myCohortId: string | null;
  openCohortId: string | null;
  busy: boolean;
  isAdmin: boolean;
  onOpenCohort: (_cohortId: string) => void;
}) {
  const t = usePPTheme();
  const others = cohorts.filter((cohort) => cohort.id !== myCohortId);
  if (others.length === 0) return null;
  const openId = openCohortId ?? myCohortId;
  return (
    <View style={[styles.card, { borderRadius: t.r(16), borderColor: t.BORDER, backgroundColor: t.CARD_BG }]}>
      <View style={styles.titleRow}>
        <Headphones size={16} color={t.ACCENT} />
        <Text style={[styles.title, { color: t.TEXT }]}>Other running cohorts</Text>
      </View>
      <Text style={[styles.lead, { color: t.SUBTLE }]}>
        {isAdmin
          ? 'Open any cohort to manage it. Posting is reserved for its members.'
          : 'Not in one of these? You can still listen in — open it to read along.'}
      </Text>
      <View style={styles.list}>
        {others.map((cohort) => (
          <CohortRow key={cohort.id} cohort={cohort} isOpen={cohort.id === openId} busy={busy} onOpen={() => onOpenCohort(cohort.id)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 20, paddingHorizontal: 24, borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 15, fontFamily: interFamily('700') },
  lead: { fontSize: 13, fontFamily: interFamily('400'), marginBottom: 14 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1 },
  rowText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontFamily: interFamily('700') },
  openBadge: {
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.3)',
    backgroundColor: 'rgba(234,179,8,0.15)',
  },
  openText: { fontSize: 10, color: '#EAB308', fontFamily: interFamily('400') },
  count: { fontSize: 12, marginTop: 2, fontFamily: interFamily('400') },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1 },
  listenText: { fontSize: 12, fontFamily: interFamily('700') },
});
