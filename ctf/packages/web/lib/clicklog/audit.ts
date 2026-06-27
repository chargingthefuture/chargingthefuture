import { randomUUID } from 'crypto';

// Audit logger for the ClickLog plugin. Mirrors the lightweight pattern used by the
// other plugins (mood/chyme/foundation): one structured line per allowed command,
// emitted to the application log. The audit contract
// (CLICKLOG_PLUGIN_AUDIT_CONTRACTS.yaml) requires an audit event on every successful
// allowed operation — clicklog.incident.create, clicklog.incident.list, and
// clicklog.incident.delete — so the route handlers call this after each success.

type ClicklogCommand =
  | 'clicklog.incident.create'
  | 'clicklog.incident.list'
  | 'clicklog.incident.delete';

type ClicklogAuditEvent = {
  actorId: string;
  command: ClicklogCommand;
  result: 'success' | 'failure';
  // Optional context identifiers (e.g. the incident id for delete). Empty/undefined
  // values are dropped so the log never carries blank keys.
  target?: Record<string, string | undefined>;
  errorCategory?: string | null;
};

function buildTargetContext(target: Record<string, string | undefined>): Record<string, string> {
  return Object.entries(target).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function logClicklogAudit(event: ClicklogAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'clicklog',
    command: event.command,
    commandVersion: '1.0.0',
    policyDecision: { status: 'allow' },
    dataClassesAccessed: ['user_event'],
    targetContext: buildTargetContext(event.target ?? {}),
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
  };

  console.info('[clicklog.audit]', JSON.stringify(payload));
}
