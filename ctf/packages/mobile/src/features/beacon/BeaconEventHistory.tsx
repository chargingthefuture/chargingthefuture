/**
 * The "Event history" card of Beacon Admin, copied from EventHistorySection and EventHistoryRow in
 * the web admin page (components/beacon/beacon-admin-shell.tsx): each event's title, its status line
 * (status, time in Eastern Time, recording state), its log, and Replay / Open / Rename / two-step
 * Delete. Rename works in every status. Delete is offered for a draft or an ended event, never a
 * live one (owner decision, 2026-11-10). The web copy is components/beacon/beacon-event-history.tsx.
 */
import React, { useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getApiBaseUrl } from '../../auth/authedFetch';
import { type BeaconAdminEvent } from './BeaconAdminApi';
import { BeaconEventLog } from './BeaconEventLog';
import { adminCardStyle, cardTitleText, chipStyle, chipText, DANGER_CHIP, DANGER_TEXT, font, inputStyle, radius, type BeaconTokens } from './BeaconTheme';
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
  renamingId: string | null;
  onOpen: (_eventId: string) => void;
  onDelete: (_eventId: string) => void;
  onRename: (_eventId: string, _title: string) => Promise<boolean>;
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

// What a confirmed delete removes, shown while Delete is armed. Same words as the web's
// beaconDeleteWarning in components/beacon/beacon-event-history.tsx.
function deleteWarning(event: BeaconAdminEvent): string {
  return event.status === 'draft'
    ? 'Deletes this draft. It cannot be undone.'
    : 'Deletes this broadcast and its replay from the app, Today, the podcast feed and the Commons. It cannot be undone.';
}

function DeleteControls({ t, event, confirmDeleteId, deletingId, onDelete, onArmDelete, onCancelDelete }: EventHistoryProps & { event: BeaconAdminEvent }) {
  // A live broadcast is ended first; the route refuses it too.
  if (event.status === 'live') return null;
  if (confirmDeleteId !== event.id) {
    return <Chip t={t} label="Delete" onPress={() => onArmDelete(event.id)} accessibilityLabel={`Delete "${event.title}"`} />;
  }
  return (
    <>
      <Chip t={t} danger label={deletingId === event.id ? 'Deleting…' : 'Confirm delete'} disabled={deletingId === event.id} onPress={() => onDelete(event.id)} />
      <Chip t={t} label="Cancel" onPress={onCancelDelete} />
    </>
  );
}

// The rename box: the title in a field with Save and Cancel. Submitting from the keyboard saves.
function TitleEditor({ t, event, saving, onSave, onCancel }: {
  t: BeaconTokens;
  event: BeaconAdminEvent;
  saving: boolean;
  onSave: (_title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(event.title);
  return (
    <View style={styles.editor}>
      <TextInput
        accessibilityLabel={`New title for "${event.title}"`}
        value={draft}
        autoFocus
        maxLength={160}
        onChangeText={setDraft}
        onSubmitEditing={() => onSave(draft)}
        returnKeyType="done"
        style={[inputStyle(t), styles.editorInput]}
      />
      <View style={styles.rowActions}>
        <Chip t={t} label={saving ? 'Saving…' : 'Save'} disabled={saving || draft.trim().length === 0} onPress={() => onSave(draft)} />
        <Chip t={t} label="Cancel" disabled={saving} onPress={onCancel} />
      </View>
    </View>
  );
}

// One event row: title (or the rename box), status line and log, then the actions on their own
// line so four controls fit the phone's width.
function EventHistoryRow(props: EventHistoryProps & { event: BeaconAdminEvent; editing: boolean; onEdit: (_id: string | null) => void }) {
  const { t, event, onOpen, editing, onEdit, renamingId, confirmDeleteId, onRename } = props;
  const save = async (title: string) => {
    if (title.trim() === event.title) {
      onEdit(null);
      return;
    }
    if (await onRename(event.id, title)) onEdit(null);
  };
  return (
    <View style={[styles.row, { borderRadius: radius(t, 10), backgroundColor: t.SURFACE, borderColor: t.BORDER_SOLID }]}>
      <View style={styles.rowText}>
        {editing ? (
          <TitleEditor t={t} event={event} saving={renamingId === event.id} onSave={(title) => void save(title)} onCancel={() => onEdit(null)} />
        ) : (
          <Text style={[styles.rowTitle, { color: t.TITLE }]} numberOfLines={1}>{event.title}</Text>
        )}
        <Text style={[styles.rowStatus, { color: t.SUBTLE }]}>{eventStatusLine(event)}</Text>
        <BeaconEventLog title={event.title} recordingLookup={event.recordingLookup} log={event.log ?? []} t={t} />
      </View>
      <View style={styles.rowActions}>
        {event.recordingUrl ? <Chip t={t} label="Replay" onPress={() => openReplay(event.id)} /> : null}
        {event.status !== 'ended' ? <Chip t={t} label="Open" onPress={() => onOpen(event.id)} /> : null}
        {editing ? null : <Chip t={t} label="Rename" onPress={() => onEdit(event.id)} accessibilityLabel={`Rename "${event.title}"`} />}
        <DeleteControls {...props} />
      </View>
      {confirmDeleteId === event.id ? (
        <Text accessibilityRole="alert" style={[styles.warning, { color: DANGER_TEXT }]}>{deleteWarning(event)}</Text>
      ) : null}
    </View>
  );
}

export function BeaconEventHistory(props: EventHistoryProps) {
  const { t, loading, events } = props;
  // Which row's title is open for renaming; one at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <View style={adminCardStyle(t)}>
      <Text style={cardTitleText(t)}>Event history</Text>
      {loading ? (
        <Text style={[styles.empty, { color: t.SUBTLE }]}>Loading…</Text>
      ) : events.length === 0 ? (
        <Text style={[styles.empty, { color: t.SUBTLE }]}>No events yet. Create one above.</Text>
      ) : (
        <View style={styles.list}>
          {events.map((event) => <EventHistoryRow key={event.id} {...props} event={event} editing={editingId === event.id} onEdit={setEditingId} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  empty: { fontSize: 14, ...font('400') },
  row: { gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1 },
  rowText: { minWidth: 0 },
  rowTitle: { fontSize: 14, ...font('600') },
  rowStatus: { fontSize: 12, ...font('400') },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editor: { gap: 8, marginBottom: 4 },
  editorInput: { marginBottom: 0 },
  warning: { fontSize: 12, ...font('400') },
});
