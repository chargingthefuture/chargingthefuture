import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { recordChymeAdminAudit } from 'lib/chyme/admin-audit';
import type { ChymeAuditEvent } from 'lib/chyme/types';

// Shared by the readings-loop admin routes: the JSON body, the error shape, and the audit row every
// admin action writes (owner directive 2026-08-28), in Chyme's own admin trail.

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    // no-trace: an unreadable body is answered as a missing field by the caller, with the field named.
    return {};
  }
}

export function invalid(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.invalidPayload, message }, { status: 400 });
}

export function recordReadingsAudit(input: {
  actorId: string;
  command: ChymeAuditEvent['command'];
  targetType: string;
  targetId: string;
  ok: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  return recordChymeAdminAudit({
    pluginId: 'chyme',
    command: input.command,
    actorId: input.actorId,
    status: 'allow',
    reason: 'role=admin',
    target: { type: input.targetType, id: input.targetId },
    targetType: input.targetType,
    targetId: input.targetId,
    result: input.ok ? 'success' : 'failure',
    errorCategory: input.ok ? null : 'persistence_error',
    metadata: input.metadata,
  });
}
