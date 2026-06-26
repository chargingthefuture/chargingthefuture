import { randomUUID } from 'crypto';

// Audit logger for the Mood plugin. Mirrors the lightweight pattern used by the
// other plugins (chyme/foundation): one structured line per command decision,
// emitted to the application log. The mood.check.submit and
// mood.check.eligibility.fetch commands are marked containsPHI in the access
// policy, so every allow/deny decision must leave an audit trail per the audit
// contract (MOOD_PLUGIN_AUDIT_CONTRACTS.yaml).

type MoodCommand = 'mood.check.submit' | 'mood.check.eligibility.fetch';

type MoodAuditEvent = {
  actorId: string;
  command: MoodCommand;
  status: 'allow' | 'deny';
  reason: string;
  // Per-check evidence (e.g. roleCheck / moodBoundsCheck / cooldownCheck for
  // submit; roleCheck / clientIdCheck for eligibility). Each value is 'pass' or
  // 'fail' so the decision can be reconstructed from the log alone.
  evidence: Record<string, 'pass' | 'fail'>;
  dataClassesAccessed: string[];
  // Optional context identifiers; empty/undefined values are dropped so the log
  // never carries blank keys.
  target: Record<string, string | undefined>;
  result: 'success' | 'failure';
  errorCategory?: string | null;
};

function buildTargetContext(target: MoodAuditEvent['target']): Record<string, string> {
  return Object.entries(target).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function logMoodAudit(event: MoodAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'mood',
    command: event.command,
    commandVersion: '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
      evidence: event.evidence,
    },
    dataClassesAccessed: event.dataClassesAccessed,
    targetContext: buildTargetContext(event.target),
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
  };

  console.info('[mood.audit]', JSON.stringify(payload));
}
