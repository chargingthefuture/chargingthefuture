import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { ChymeModerationError } from 'lib/chyme/moderation';
import { recordChymeAdminAudit } from 'lib/chyme/admin-audit';
import type { ChymeAuditEvent } from 'lib/chyme/types';
import type { StreamModerationResult } from 'lib/chyme/stream-moderation';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
import { ensureMutationCsrf, readChymeRoomScope, requireChymeAdminAccess, type ChymeApiGate } from '../_lib';
import { chymeRoomKeyForScope } from 'lib/chyme/constants';

// Shared by the Chyme moderation routes: the admin gate plus CSRF, the JSON body, the answer shapes.
// Every route here records a durable audit row (recordChymeAdminAudit) whatever the outcome.

export type ModerationGate =
  | { allowed: true; gate: Extract<ChymeApiGate, { allowed: true }>; roomKey: string }
  | { allowed: false; response: NextResponse };

export async function requireChymeAdminModerationAccess(request: Request): Promise<ModerationGate> {
  const gate = await requireChymeAdminAccess();
  if (!gate.allowed) {
    return { allowed: false, response: gate.response };
  }
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return { allowed: false, response: csrfDeny };
  }
  return { allowed: true, gate, roomKey: chymeRoomKeyForScope(readChymeRoomScope(request)) };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    // no-trace: an unreadable body is answered as a missing field by the caller, with the field named.
    return {};
  }
}

export function stringField(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function missingField(name: string): NextResponse {
  return NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.invalidPayload, message: `${name} is required.` }, { status: 400 });
}

// The answer once the database half is done: ok, plus the Stream half's own words when it did not
// apply — the admin's decision stands (it is recorded and enforced by this app), and they are told
// exactly what Stream did not do.
export function moderationResponse(stream: StreamModerationResult, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      ...extra,
      streamApplied: stream.ok,
      streamNotice: stream.ok ? undefined : `Recorded, but Stream did not apply it in the call: ${stream.reason}`,
    },
    { status: 200 },
  );
}

type AuditInput = {
  actorId: string;
  command: ChymeAuditEvent['command'];
  targetType: string;
  targetId: string;
  roomKey: string;
  metadata?: Record<string, unknown>;
};

export function recordModerationAudit(input: AuditInput): Promise<void> {
  return recordChymeAdminAudit({
    pluginId: 'chyme',
    command: input.command,
    actorId: input.actorId,
    status: 'allow',
    reason: 'role=admin',
    target: { roomKey: input.roomKey, targetId: input.targetId },
    result: 'success',
    errorCategory: null,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
  });
}

// Map a failure to the answer and the audit row. A ChymeModerationError is the admin's own input
// (member not in the room); anything else is a fault, reported with its reason.
export async function recordModerationAuditFailure(error: unknown, input: AuditInput, op: string): Promise<NextResponse> {
  const known = error instanceof ChymeModerationError;
  if (!known) {
    reportError(error, { area: 'chyme', op, extra: { roomKey: input.roomKey, targetId: input.targetId } });
  }
  await recordChymeAdminAudit({
    pluginId: 'chyme',
    command: input.command,
    actorId: input.actorId,
    status: known ? 'deny' : 'allow',
    reason: known ? error.kind : 'role=admin',
    target: { roomKey: input.roomKey, targetId: input.targetId },
    result: 'failure',
    errorCategory: known ? 'validation_error' : 'internal_error',
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
  });
  if (known) {
    return NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.memberNotInRoom, message: error.message }, { status: 409 });
  }
  return NextResponse.json(
    { ok: false, code: CHYME_ERROR_CODE.internalError, message: `The action did not complete: ${failureReason(error)}` },
    { status: 500 },
  );
}
