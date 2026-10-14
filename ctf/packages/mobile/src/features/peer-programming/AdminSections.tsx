// The member feedback inbox and the single standing Cohort 1 switch on the PeerProgramming admin
// screen, copied from the web admin (web components/peer-programming/pp-admin-shell.tsx).
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { interFamily } from '../../components/ui';
import type { FeedbackItem, SingleOpenCohortMode } from './PeerProgrammingAdminApi';
import { AdminSection, EmptyLine, SectionLead, SectionTitle } from './AdminParts';
import { usePPTheme } from './usePPTheme';

function formatFeedbackTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  const t = usePPTheme();
  return (
    <View style={[styles.row, { borderRadius: t.r(10), backgroundColor: t.HEADER, borderColor: t.BORDER_SOLID }]}>
      <View style={styles.feedbackHead}>
        <Text style={[styles.author, { color: t.TITLE }]}>{item.authorName ?? `Member ${item.userId.slice(0, 6)}`}</Text>
        <Text style={[styles.time, { color: t.MUTED }]}>{formatFeedbackTime(item.createdAtIso)}</Text>
      </View>
      <Text style={styles.note}>{item.note}</Text>
    </View>
  );
}

export function FeedbackSection({ feedback }: { feedback: FeedbackItem[] }) {
  return (
    <AdminSection>
      <SectionTitle text="Member feedback" />
      <SectionLead>
        What members sent from PeerProgramming, newest first. This is an inbox to read, not a queue to clear — the
        admin dot flags feedback that arrived since you last opened this page.
      </SectionLead>
      {feedback.length === 0 ? (
        <EmptyLine text="No feedback yet." />
      ) : (
        <View style={styles.list}>
          {feedback.map((item) => <FeedbackRow key={item.id} item={item} />)}
        </View>
      )}
    </AdminSection>
  );
}

function sourceLabel(source: SingleOpenCohortMode['source']): string {
  if (source === 'admin_setting') return 'admin setting';
  if (source === 'env_flag') return 'server setting';
  return 'default';
}

function ModeStatus({ mode }: { mode: SingleOpenCohortMode }) {
  const t = usePPTheme();
  const on = mode.enabled;
  return (
    <View style={[styles.row, styles.modeRow, { borderRadius: t.r(10), backgroundColor: t.HEADER, borderColor: t.BORDER_SOLID }]}>
      <View
        style={[styles.modeBadge, {
          borderRadius: t.r(6),
          backgroundColor: on ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.18)',
          borderColor: on ? 'rgba(34,197,94,0.3)' : t.BORDER_SOLID,
        }]}
      >
        <Text style={[styles.modeBadgeText, { color: on ? '#22C55E' : t.MUTED }]}>{on ? 'On' : 'Off'}</Text>
      </View>
      <Text style={[styles.source, { color: t.MUTED }]}>
        Source: <Text style={[styles.sourceValue, { color: t.TITLE }]}>{sourceLabel(mode.source)}</Text>
      </Text>
    </View>
  );
}

function ModeButton({ label, disabled, saving, look, onPress }: {
  label: string;
  disabled: boolean;
  saving: boolean;
  look: { background: string; color: string; border: string };
  onPress: () => void;
}) {
  const t = usePPTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.modeButton, { borderRadius: t.r(9), backgroundColor: look.background, borderColor: look.border, opacity: saving ? 0.7 : 1 }]}
    >
      <Text style={[styles.modeButtonText, { color: look.color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SingleOpenCohortSection({ mode, saving, onSet }: {
  mode: SingleOpenCohortMode | null;
  saving: boolean;
  onSet: (_enabled: boolean | null) => void;
}) {
  const t = usePPTheme();
  const isAdminSetting = mode?.source === 'admin_setting';
  return (
    <AdminSection>
      <SectionTitle text="Single standing Cohort 1 mode" />
      <SectionLead>
        While there are too few active members to fill weekly cohorts of up to 12 people, everyone shares one standing,
        always-open Cohort 1 instead of being split into tiny rooms. Turn it off to resume the weekly split into C1, C2, C3.
      </SectionLead>
      {mode ? (
        <>
          <ModeStatus mode={mode} />
          <View style={styles.modeButtons}>
            <ModeButton label="Turn on" saving={saving} disabled={saving || (isAdminSetting && mode.adminSetting === true)}
              look={{ background: `${t.ACCENT}1F`, color: t.ACCENT, border: `${t.ACCENT}40` }} onPress={() => onSet(true)} />
            <ModeButton label="Turn off" saving={saving} disabled={saving || (isAdminSetting && mode.adminSetting === false)}
              look={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.3)' }} onPress={() => onSet(false)} />
            {isAdminSetting ? (
              <ModeButton label="Clear override (use server setting)" saving={saving} disabled={saving}
                look={{ background: 'transparent', color: t.MUTED, border: t.BORDER_SOLID }} onPress={() => onSet(null)} />
            ) : null}
          </View>
        </>
      ) : (
        <EmptyLine text="The current mode could not be read." />
      )}
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  feedbackHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  author: { fontSize: 13, fontFamily: interFamily('700') },
  time: { fontSize: 11, marginLeft: 'auto', fontFamily: interFamily('400') },
  note: { fontSize: 13, color: '#D1D5DB', marginTop: 6, lineHeight: 19.5, fontFamily: interFamily('400') },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  modeBadge: { paddingVertical: 3, paddingHorizontal: 10, borderWidth: 1 },
  modeBadgeText: { fontSize: 12, fontFamily: interFamily('700') },
  source: { fontSize: 12, fontFamily: interFamily('400') },
  sourceValue: { fontFamily: interFamily('600') },
  modeButtons: { gap: 8 },
  modeButton: { paddingVertical: 9, paddingHorizontal: 16, borderWidth: 1, alignItems: 'center' },
  modeButtonText: { fontSize: 13, fontFamily: interFamily('700') },
});
