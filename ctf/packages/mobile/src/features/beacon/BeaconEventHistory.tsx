/**
 * The "Event history" card of Beacon Admin, copied from EventHistorySection and EventHistoryRow in
 * the web admin page (components/beacon/beacon-admin-shell.tsx): each event's title, its status line
 * (status, time in Eastern Time, recording state), its log, and Replay / Open / two-step Delete.
 * Delete is offered for drafts only; a live or ended event is public history.
 */
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getApiBaseUrl } from '../../auth/authedFetch';
import { type BeaconAdminEvent } from './BeaconAdminApi';
import { BeaconEventLog } from './BeaconEventLog';
import { adminCardStyle, cardTitleText, chipStyle, chipText, DANGER_CHIP, DANGER_TEXT, font, radius, type BeaconTokens } from './BeaconTheme';
import { reportError } from '../../observability/report';

// "Oct 6, 2026, 3:05 PM ET": when it went live, or when a draft was created.
const EASTERN_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatEventTimeEt(event: BeaconAdminEvent): string | null {
  const iso = event.startedAtIso ?? event.createdAtIso;
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${EASTERN_TIME.format(date)} ET`;
}

function eventStatusLine(event: BeaconAdminEvent): string {
  const time = formatEventTimeEt(event);
  const parts: string[] = [event.status];
  if (time) parts.push(time);
  if (event.recordingUrl) parts.push('recording ready');
  else if (event.status === 'ended') parts.push('no recording found');
  return parts.join(' · ');
}

// The web Replay link opens the public recording route in a new tab; here it opens the browser.
function openReplay(eventId: string): void {
  try {
    Linking.openURL(`${getApiBaseUrl()}/api/beacon/replays/${eventId}/recording`).catch((error: unknown) => {
      reportError(error, { area: 'beacon', op: 'open_replay', extra: { eventId } });
    });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'open_replay', extra: { eventId } });
  }
}

export type EventHistoryProps = {
  t: BeaconTokens;
  loading: boolean;
  events: BeaconAdminEvent[];
  confirmDeleteId: string | null;
  deletingId: string | null;
  onOpen: (_eventId: string) => void;
  onDelete: (_eventId: string) => void;
  onArmDelete: (_eventId: string) => void;
  onCancelDelete: () => void;
};

function Chip({ t, label, onPress, danger, disabled, accessibilityLabel }: {
  t: BeaconTokens;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[chipStyle(t), danger ? DANGER_CHIP : null]}
    >
      <Text style={[chipText(t), danger ? { color: DANGER_TEXT } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DeleteControls({ t, event, confirmDeleteId, deletingId, onDelete, onArmDelete, onCancelDelete }: EventHistoryProps & { event: BeaconAdminEvent }) {
  if (event.status !== 'draft') return null;
  if (confirmDeleteId !== event.id) {
    return <Chip t={t} label="Delete" onPress={() => onArmDelete(event.id)} accessibilityLabel={`Delete the draft "${event.title}"`} />;
  }
  return (
    <>
      <Chip t={t} danger label={deletingId === event.id ? 'Deleting…' : 'Confirm delete'} disabled={deletingId === event.id} onPress={() => onDelete(event.id)} />
      <Chip t={t} label="Cancel" onPress={onCancelDelete} />
    </>
  );
}

function EventHistoryRow(props: EventHistoryProps & { event: BeaconAdminEvent }) {
  const { t, event, onOpen } = props;
  return (
    <View style={[styles.row, { borderRadius: radius(t, 10), backgroundColor: t.SURFACE, borderColor: t.BORDER_SOLID }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: t.TITLE }]} numberOfLines={1}>{event.title}</Text>
        <Text style={[styles.rowStatus, { color: t.SUBTLE }]}>{eventStatusLine(event)}</Text>
        <BeaconEventLog title={event.title} recordingLookup={event.recordingLookup} log={event.log ?? []} t={t} />
      </View>
      <View style={styles.rowActions}>
        {event.recordingUrl ? <Chip t={t} label="Replay" onPress={() => openReplay(event.id)} /> : null}
        {event.status !== 'ended' ? <Chip t={t} label="Open" onPress={() => onOpen(event.id)} /> : null}
        <DeleteControls {...props} />
      </View>
    </View>
  );
}

export function BeaconEventHistory(props: EventHistoryProps) {
  const { t, loading, events } = props;
  return (
    <View style={adminCardStyle(t)}>
      <Text style={cardTitleText(t)}>Event history</Text>
      {loading ? (
        <Text style={[styles.empty, { color: t.SUBTLE }]}>Loading…</Text>
      ) : events.length === 0 ? (
        <Text style={[styles.empty, { color: t.SUBTLE }]}>No events yet. Create one above.</Text>
      ) : (
        <View style={styles.list}>
          {events.map((event) => <EventHistoryRow key={event.id} {...props} event={event} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  empty: { fontSize: 14, ...font('400') },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, ...font('600') },
  rowStatus: { fontSize: 12, ...font('400') },
  rowActions: { flexDirection: 'row', gap: 8 },
});
