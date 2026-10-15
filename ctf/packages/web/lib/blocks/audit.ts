// Audit line for the safety report a member attaches to a block (`member.safety-report.create`,
// which the access policy marks `requiresAdditionalAudit: true`). Like `lib/account/audit.ts` it
// writes one structured JSON line on `console.info` and no table row: the report row in
// member_safety_reports is the durable record, and a row naming who blocked whom is the record this
// plugin deliberately does not keep. So the line carries the reporting member, the decision and the
// outcome only — never the blocked member's id or the report text.

import { randomUUID } from 'crypto';

export type SafetyReportAuditEvent = {
  /** The member raising the report. */
  readonly actorId: string;
  readonly status: 'allow' | 'deny';
  readonly reason: string;
  readonly result: 'success' | 'failure';
  readonly errorCategory: string | null;
};

export function logSafetyReportCreateAudit(event: SafetyReportAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'member-blocks',
    command: 'member.safety-report.create',
    commandVersion: '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: { scope: 'user' },
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
  };

  console.info('[member-blocks.audit]', JSON.stringify(payload));
}
