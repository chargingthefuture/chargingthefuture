import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireGentlePulseWriteAccess } from 'lib/gentle-pulse/_lib';
import { trackPlayEvent } from 'lib/gentle-pulse/repository';
import { logGentlePulseAudit } from 'lib/gentle-pulse/audit';

const COMMAND = 'gentle-pulse.meditation.play.record';

type ItemParams = {
  params: Promise<{ itemId: string }>;
};

type PlayBody = {
  anonymousClientId?: string;
  completed?: boolean;
};

export async function POST(request: Request, context: ItemParams) {
  const { itemId } = await context.params;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    logGentlePulseAudit({
      actorId: null,
      command: COMMAND,
      status: 'deny',
      reason: 'csrf_denied',
      result: 'failure',
      errorCategory: 'csrf',
      meditationId: itemId,
    });
    return csrfDeny;
  }

  const gate = await requireGentlePulseWriteAccess();
  if (!gate.allowed) {
    logGentlePulseAudit({
      actorId: null,
      command: COMMAND,
      status: 'deny',
      reason: 'access_denied',
      result: 'failure',
      errorCategory: 'authz',
      meditationId: itemId,
    });
    return gate.response;
  }

  let body: PlayBody = {};
  try {
    body = (await request.json()) as PlayBody;
  } catch {
  }

  const { playCount, mediaUrl } = await trackPlayEvent({
    userId: gate.auth.userId,
    anonymousClientId: typeof body.anonymousClientId === 'string' ? body.anonymousClientId : null,
    itemId,
    completed: Boolean(body.completed),
  });

  logGentlePulseAudit({
    actorId: gate.auth.userId,
    command: COMMAND,
    status: 'allow',
    reason: 'policy_pass',
    result: 'success',
    meditationId: itemId,
  });

  return NextResponse.json({ ok: true, meditationId: itemId, playCount, mediaUrl }, { status: 201 });
}
