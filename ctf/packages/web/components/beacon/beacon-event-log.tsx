'use client';

import { useState } from 'react';
import type { BeaconTokens } from './beacon-shared';
import { reportError } from 'lib/observability/report';

export type BeaconEventLogEntry = {
  atIso: string;
  command: string;
  ok: boolean;
  reason: string;
};

// Plain names for the audit commands, so the log reads as steps of a broadcast rather than code.
const STEP_LABELS: Record<string, string> = {
  'beacon.event.create': 'Draft created',
  'beacon.event.ingest': 'Stream key shown',
  'beacon.event.go-live': 'Went live',
  'beacon.event.start-broadcast': 'Screen share asked to start the feed and recording',
  'beacon.viewer.start-broadcast': 'Live page asked to start the feed and recording',
  'beacon.stream.publisher-joined': 'Broadcaster joined; feed and recording asked to start',
  'beacon.stream.recording-started': 'Stream started recording',
  'beacon.stream.recording-stopped': 'Stream stopped recording',
  'beacon.stream.recording-failed': 'Stream recording failed',
  'beacon.stream.recording-ready': 'Recording file ready',
  'beacon.event.end': 'Ended',
  'beacon.event.moderate': 'Chat moderation',
};

const TIME_ET = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

function formatEntry(entry: BeaconEventLogEntry): string {
  const date = new Date(entry.atIso);
  const time = Number.isNaN(date.getTime()) ? '' : `${TIME_ET.format(date)} ET · `;
  const label = STEP_LABELS[entry.command] ?? entry.command;
  const outcome = entry.ok ? '' : ` — ${entry.reason || 'failed'}`;
  return `${time}${label}${outcome}`;
}

// The log under an event in the admin history: what Stream says about the recording right now, then
// each broadcast step the app took or Stream reported, with the reason for any that failed. "Copy
// log" puts it on the clipboard as plain text, so it can be pasted into a message from a phone.
export function BeaconEventLog({
  title,
  recordingLookup,
  log,
  t,
}: {
  title: string;
  recordingLookup?: string;
  log: BeaconEventLogEntry[];
  t: BeaconTokens;
}) {
  const [copied, setCopied] = useState(false);
  if (!recordingLookup && log.length === 0) {
    return null;
  }
  const lines = [
    ...(recordingLookup ? [`Recording: ${recordingLookup}`] : []),
    ...(log.length > 0 ? log.map(formatEntry) : ['No broadcast steps were logged for this event.']),
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText([title, ...lines].join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      reportError(error, { area: 'beacon', op: 'copy_event_log' });
    }
  };

  return (
    <details style={{ marginTop: 6, fontSize: 12, color: t.SUBTLE }}>
      <summary style={{ cursor: 'pointer' }}>Log</summary>
      <ul style={{ margin: '6px 0', paddingLeft: 16, display: 'grid', gap: 4 }}>
        {lines.map((line, index) => (
          <li key={index} style={{ overflowWrap: 'anywhere', color: line.includes(' — ') || (index === 0 && recordingLookup) ? t.TITLE : t.SUBTLE }}>
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void copy()}
        style={{ padding: '5px 10px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        {copied ? 'Copied' : 'Copy log'}
      </button>
    </details>
  );
}
