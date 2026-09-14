import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import type { TiRadioAuditEvent } from './types';

// Two halves, and only one of them is a record.
//
// The log line is useful while something is being debugged and nothing can query it, no screen can
// read it, and it ages out of the host's retention window. So every command that changes the guide
// also writes a row. Taking a member's slot off a public schedule is the action that most needs to
// be answerable for afterwards, and this app has one admin — the person who can do it is the only
// person who could hide having done it.

function buildTargetContext(target: TiRadioAuditEvent['target']): Record<string, string> {
  return Object.entries(target).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function logTiRadioAudit(event: TiRadioAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: event.pluginId,
    command: event.command,
    commandVersion: '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
      ...(event.evidence ? { evidence: event.evidence } : {}),
    },
    targetContext: buildTargetContext(event.target),
    result: { status: event.result, errorCategory: event.errorCategory ?? 'none' },
  };
  console.info('[ti-radio.audit]', JSON.stringify(payload));
}

/**
 * Write the durable row, and the log line with it. Never throws: an audit write that failed would
 * otherwise turn a completed removal into a 503, and an admin repeating a removal they have already
 * made is worse than a gap in the trail. The failure goes to the observability channel instead.
 */
export async function recordTiRadioAudit(event: TiRadioAuditEvent): Promise<void> {
  logTiRadioAudit(event);
  const [targetType, targetId] = Object.entries(event.target).find(
    ([, value]) => typeof value === 'string' && value.length > 0,
  ) ?? ['ti_radio_slot', ''];
  try {
    await queryDb(
      `
        INSERT INTO ti_radio_admin_audit_trail
          (actor_id, command, policy_status, reason, target_type, target_id, result, error_category, metadata)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        event.actorId,
        event.command,
        event.status,
        event.reason,
        targetType,
        String(targetId ?? ''),
        event.result,
        event.errorCategory,
        JSON.stringify(event.evidence ? { evidence: event.evidence } : {}),
      ],
    );
  } catch (error) {
    reportError(error, { area: 'ti-radio', op: 'audit_write' });
  }
}
