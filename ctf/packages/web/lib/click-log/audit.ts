import { randomUUID } from 'crypto';

// Audit logger for the ClickLog plugin. Mirrors the lightweight pattern used by the
// other plugins (mood/chyme/foundation): one structured line per allowed command,
// emitted to the application log. The audit contract
// (CLICK_LOG_PLUGIN_AUDIT_CONTRACTS.yaml) requires an audit event on every successful
// allowed operation — incident create/list/delete, the per-incident share toggle, the
// preferences fetch/update, and the admin trends fetch — so the route handlers call
// this after each success. The shareable trends image is audited the same way, and records that
// the copy carried no area coordinates — the image never carries them, and the line stays in the
// log so a posted copy can be matched to what it held.

type ClickLogCommand =
  | 'click-log.incident.create'
  | 'click-log.incident.list'
  | 'click-log.incident.delete'
  | 'click-log.incident.update'
  | 'click-log.incident.share.set'
  | 'click-log.preferences.fetch'
  | 'click-log.preferences.update'
  | 'click-log.trends.fetch'
  | 'click-log.trends.image';

type ClickLogAuditEvent = {
  actorId: string;
  command: ClickLogCommand;
  result: 'success' | 'failure';
  // Optional context identifiers (e.g. the incident id for delete). Empty/undefined
  // values are dropped so the log never carries blank keys. Values here are never member data:
  // an incident id, or which variant of the trends image was produced.
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

export function logClickLogAudit(event: ClickLogAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'click-log',
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

  console.info('[click-log.audit]', JSON.stringify(payload));
}
