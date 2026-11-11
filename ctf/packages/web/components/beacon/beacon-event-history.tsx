'use client';

// The "Event history" card of Beacon Admin: every event newest first, with its status line, its log,
// and Replay / Open / Rename / two-step Delete.
//
//   - Rename works in every status: before going live, while live, and after the broadcast ended
//     (owner report: a typo in a title could not be fixed). PATCH /api/beacon/[id].
//   - Delete works on a draft or an ended event, never a live one (owner decision, 2026-11-10: a
//     failed broadcast with no sound, or a test, is removed from the app rather than kept). It
//     removes the event from the replays list, Today and the podcast feed, and its Commons notices.
//     DELETE /api/beacon/[id], which refuses a live event and is the real guard.
//
// The Android app's copy is src/features/beacon/BeaconEventHistory.tsx; change both together.
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getBeaconTokens } from './beacon-shared';
import { BeaconEventLog, type BeaconEventLogEntry } from './beacon-event-log';
import { cardStyle, cardTitleStyle, chipButtonStyle, dangerButtonStyle, inputStyle } from './beacon-admin-styles';

export type BeaconEvent = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'live' | 'ended';
  startedAtIso: string | null;
  endedAtIso: string | null;
  recordingUrl: string | null;
  commonsLivePostId: string | null;
  commonsRecordingPostId: string | null;
  createdAtIso: string;
  // Admin list only: what Stream said when asked for a missing recording, and the event's log.
  recordingLookup?: string;
  log?: BeaconEventLogEntry[];
};

// When the event happened, in Eastern Time: when it went live for a broadcast event, when it was
// created for a draft. "Oct 6, 2026, 3:05 PM ET".
const EASTERN_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatEventTimeEt(event: BeaconEvent): string | null {
  const iso = event.startedAtIso ?? event.createdAtIso;
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return `${EASTERN_TIME.format(date)} ET`;
}

// The line under an event's title: status, time in ET, and whether its recording is ready.
function eventStatusLine(event: BeaconEvent): string {
  const time = formatEventTimeEt(event);
  const parts: string[] = [event.status];
  if (time) parts.push(time);
  if (event.recordingUrl) parts.push('recording ready');
  else if (event.status === 'ended') parts.push('no recording found');
  return parts.join(' · ');
}

// What a confirmed delete removes, shown while Delete is armed so the second press is informed.
export function beaconDeleteWarning(event: { status: string }): string {
  return event.status === 'draft'
    ? 'Deletes this draft. It cannot be undone.'
    : 'Deletes this broadcast and its replay from the app, Today, the podcast feed and the Commons. It cannot be undone.';
}

export type EventHistoryActions = {
  confirmDeleteId: string | null;
  deletingId: string | null;
  renamingId: string | null;
  onOpen: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onArmDelete: (eventId: string) => void;
  onCancelDelete: () => void;
  onRename: (eventId: string, title: string) => Promise<boolean>;
};

// The title, or while renaming, a box holding it with Save and Cancel. Enter saves, Escape cancels.
function TitleOrEditor({ event, editing, saving, onSave, onCancel }: {
  event: BeaconEvent;
  editing: boolean;
  saving: boolean;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const t = getBeaconTokens(theme);
  const [draft, setDraft] = useState(event.title);
  // Put the cursor in the box when it opens, so the new title can be typed straight away. Done on
  // open rather than with autoFocus, which the accessibility check refuses because it moves focus
  // on page load; here it only follows the admin pressing Rename.
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  if (!editing) {
    return <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>;
  }
  const save = () => onSave(draft);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
      <input
        aria-label={`New title for "${event.title}"`}
        ref={inputRef}
        value={draft}
        maxLength={160}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
        style={{ ...inputStyle(t), marginBottom: 0, flex: '1 1 200px', minWidth: 0 }}
      />
      <button type="button" onClick={save} disabled={saving || draft.trim().length === 0} style={chipButtonStyle(t)}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={onCancel} disabled={saving} style={chipButtonStyle(t)}>Cancel</button>
    </div>
  );
}

function DeleteControls({ event, confirmDeleteId, deletingId, onDelete, onArmDelete, onCancelDelete }: EventHistoryActions & { event: BeaconEvent }) {
  const { theme } = useTheme();
  const t = getBeaconTokens(theme);
  // A live broadcast is ended first; the route refuses it too.
  if (event.status === 'live') return null;
  if (confirmDeleteId !== event.id) {
    return (
      <button type="button" onClick={() => onArmDelete(event.id)} aria-label={`Delete "${event.title}"`} style={chipButtonStyle(t)}>
        Delete
      </button>
    );
  }
  return (
    <>
      <button type="button" onClick={() => onDelete(event.id)} disabled={deletingId === event.id} style={dangerButtonStyle(t)}>
        {deletingId === event.id ? 'Deleting…' : 'Confirm delete'}
      </button>
      <button type="button" onClick={onCancelDelete} style={chipButtonStyle(t)}>Cancel</button>
    </>
  );
}

// One event row: title (or the rename box), status line and log, then the actions on their own
// line so four controls fit a phone-width row.
function EventHistoryRow(props: EventHistoryActions & { event: BeaconEvent; editing: boolean; onEdit: (id: string | null) => void }) {
  const { event, editing, onEdit, renamingId, confirmDeleteId, onOpen, onRename } = props;
  const { theme } = useTheme();
  const t = getBeaconTokens(theme);
  const save = async (title: string) => {
    if (title.trim() === event.title) {
      onEdit(null);
      return;
    }
    if (await onRename(event.id, title)) onEdit(null);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ minWidth: 0 }}>
        <TitleOrEditor key={editing ? 'edit' : 'view'} event={event} editing={editing} saving={renamingId === event.id} onSave={(title) => void save(title)} onCancel={() => onEdit(null)} />
        <div style={{ fontSize: 12, color: t.SUBTLE }}>{eventStatusLine(event)}</div>
        <BeaconEventLog title={event.title} recordingLookup={event.recordingLookup} log={event.log ?? []} t={t} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {event.recordingUrl ? (
          <a href={`/api/beacon/replays/${event.id}/recording`} target="_blank" rel="noreferrer" style={chipButtonStyle(t)}>Replay</a>
        ) : null}
        {event.status !== 'ended' ? (
          <button type="button" onClick={() => onOpen(event.id)} style={chipButtonStyle(t)}>Open</button>
        ) : null}
        {editing ? null : (
          <button type="button" onClick={() => onEdit(event.id)} aria-label={`Rename "${event.title}"`} style={chipButtonStyle(t)}>Rename</button>
        )}
        <DeleteControls {...props} />
      </div>
      {confirmDeleteId === event.id ? (
        <div role="alert" style={{ fontSize: 12, color: '#F87171' }}>{beaconDeleteWarning(event)}</div>
      ) : null}
    </div>
  );
}

export function EventHistorySection({ loading, events, ...actions }: EventHistoryActions & { loading: boolean; events: BeaconEvent[] }) {
  const { theme } = useTheme();
  const t = getBeaconTokens(theme);
  // Which row's title is open for renaming; one at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <section style={cardStyle(t)}>
      <h2 style={cardTitleStyle}>Event history</h2>
      {loading ? (
        <div style={{ color: t.SUBTLE, fontSize: 14 }}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={{ color: t.SUBTLE, fontSize: 14 }}>No events yet. Create one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((event) => (
            <EventHistoryRow key={event.id} {...actions} event={event} editing={editingId === event.id} onEdit={setEditingId} />
          ))}
        </div>
      )}
    </section>
  );
}
