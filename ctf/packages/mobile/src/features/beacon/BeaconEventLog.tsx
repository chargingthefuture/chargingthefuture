/**
 * BeaconEventLog — the log under an event in the admin history, copied from the web
 * (components/beacon/beacon-event-log.tsx): what Stream says about the recording right now, then each
 * broadcast step, with the reason for any that failed. "Copy log" puts it on the clipboard as plain
 * text. The web uses a folding <details> block; here a "Log" row with the same arrow folds it.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { type BeaconEventLogEntry } from './BeaconAdminApi';
import { font, radius, type BeaconTokens } from './BeaconTheme';
import { reportError } from '../../observability/report';

// Plain names for the audit commands, the same table as the web.
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
  'beacon.stream.ingress-started': 'Phone feed connected; feed and recording asked to start',
  'beacon.stream.ingress-stopped': 'Phone feed disconnected',
  'beacon.stream.ingress-error': 'Phone feed error',
  'beacon.stream.delivery-refused': 'Stream message refused',
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

export function BeaconEventLog({ title, recordingLookup, log, t }: {
  title: string;
  recordingLookup?: string;
  log: BeaconEventLogEntry[];
  t: BeaconTokens;
}) {
  const [open, setOpen] = useState(false);
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
      await Clipboard.setStringAsync([title, ...lines].join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      reportError(error, { area: 'beacon', op: 'copy_event_log' });
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[styles.text, { color: t.SUBTLE }]}>{open ? '▼' : '▶'} Log</Text>
      </TouchableOpacity>
      {open ? (
        <>
          <View style={styles.list}>
            {lines.map((line, index) => (
              <Text
                key={index}
                style={[styles.text, { color: line.includes(' — ') || (index === 0 && recordingLookup) ? t.TITLE : t.SUBTLE }]}
              >
                {`• ${line}`}
              </Text>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => void copy()}
            accessibilityRole="button"
            style={[styles.copy, { borderRadius: radius(t, 8), backgroundColor: t.SURFACE, borderColor: t.BORDER_SOLID }]}
          >
            <Text style={[styles.copyText, { color: t.TITLE }]}>{copied ? 'Copied' : 'Copy log'}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  text: { fontSize: 12, ...font('400') },
  list: { marginVertical: 6, paddingLeft: 4, gap: 4 },
  copy: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1 },
  copyText: { fontSize: 12, ...font('600') },
});
