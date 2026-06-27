import { randomUUID } from 'crypto';

// One audit line per GentlePulse command, matching the declared events in
// docs/contracts/GENTLE_PULSE_PLUGIN_AUDIT_CONTRACTS.yaml. Modelled on the WhatWorks audit
// helper: a single structured console line that the platform log pipeline collects, emitted
// on both the allow and deny paths of every command.

// Every GentlePulse command sits at contract version 1.0.0 today; kept as a map so a future
// per-command bump records the version that actually governed the call.
const GENTLE_PULSE_COMMAND_VERSIONS: Record<string, string> = {
  'gentle-pulse.library.list': '1.0.0',
  'gentle-pulse.meditation.play.record': '1.0.0',
  'gentle-pulse.rating.upsert': '1.0.0',
};

// The data classes each command touches, mirrored from the audit contract so the recorded
// line carries the same classification the contract declares.
const GENTLE_PULSE_COMMAND_DATA_CLASSES: Record<string, string[]> = {
  'gentle-pulse.library.list': ['meditation_catalog_projection', 'favorites_projection'],
  'gentle-pulse.meditation.play.record': ['meditation_play_event_metadata', 'meditation_media_metadata'],
  'gentle-pulse.rating.upsert': ['meditation_rating_metadata', 'rating_aggregate_metadata'],
};

type GentlePulseAuditEvent = {
  // The acting member's id, or null when unauthenticated.
  actorId: string | null;
  command: string;
  status: 'allow' | 'deny';
  reason: string;
  result: 'success' | 'failure';
  errorCategory?: string | null;
  meditationId?: string | null;
  metadata?: Record<string, unknown>;
};

export function logGentlePulseAudit(event: GentlePulseAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId ?? 'anonymous',
    pluginId: 'gentle-pulse',
    command: event.command,
    commandVersion: GENTLE_PULSE_COMMAND_VERSIONS[event.command] ?? '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      meditationId: event.meditationId ?? null,
    },
    dataClassesAccessed: GENTLE_PULSE_COMMAND_DATA_CLASSES[event.command] ?? [],
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[gentle-pulse.audit]', JSON.stringify(payload));
}
