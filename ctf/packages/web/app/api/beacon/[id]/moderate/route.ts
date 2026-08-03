import { NextResponse } from 'next/server';
import { beaconErrorResponse, ensureBeaconMutationCsrf, requireBeaconAdminAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE, BEACON_DEFAULT_SLOW_MODE_SECONDS } from 'lib/beacon/constants';
import { getBeaconEvent, insertBeaconAudit } from 'lib/beacon/repository';
import { moderateBeaconChat, type BeaconModerationAction } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

type ModerateBody = {
  action?: string;
  targetUserId?: string | null;
  cooldownSeconds?: number | null;
};

const VALID_ACTIONS: BeaconModerationAction[] = ['mute', 'ban', 'slow_mode'];

// Parse and validate the moderation request body. Returns a discriminated result so the caller keeps
// TypeScript narrowing on the validated action.
async function parseModerateBody(
  request: Request,
): Promise<{ error: NextResponse } | { data: { action: BeaconModerationAction; body: ModerateBody } }> {
  let body: ModerateBody;
  try {
    body = (await request.json()) as ModerateBody;
  } catch (caught) {
    return { error: NextResponse.json({ ok: false, code: BEACON_ERROR_CODE.invalidJson, message: 'Invalid JSON body.', reason: failureReason(caught) }, { status: 400 }) };
  }

  const action = body.action as BeaconModerationAction | undefined;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return {
      error: NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.invalidPayload, message: 'action must be one of mute, ban, slow_mode.' },
        { status: 400 },
      ),
    };
  }
  if ((action === 'mute' || action === 'ban') && !body.targetUserId) {
    return {
      error: NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.invalidPayload, message: 'targetUserId is required to mute or ban.' },
        { status: 400 },
      ),
    };
  }

  return { data: { action, body } };
}

// Resolve the slow-mode cooldown, honouring an explicit 0 and defaulting when omitted; null for
// non-slow-mode actions.
function resolveCooldownSeconds(action: BeaconModerationAction, cooldownSeconds: number | null | undefined): number | null {
  if (action !== 'slow_mode') {
    return null;
  }
  if (cooldownSeconds === 0) {
    return 0;
  }
  return cooldownSeconds ?? BEACON_DEFAULT_SLOW_MODE_SECONDS;
}

// Admin: moderate the live event chat — mute a member, ban a member from the event channel, or
// toggle slow-mode.
export async function POST(request: Request, context: RouteContext) {
  const csrfDeny = ensureBeaconMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireBeaconAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  const parsed = await parseModerateBody(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { action, body } = parsed.data;

  try {
    const event = await getBeaconEvent(id);
    if (!event) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.notFound, message: 'Event not found.' },
        { status: 404 },
      );
    }

    const cooldownSeconds = resolveCooldownSeconds(action, body.cooldownSeconds);

    const applied = await moderateBeaconChat({
      eventId: event.id,
      hostUserId: gate.auth.userId,
      action,
      targetUserId: body.targetUserId ?? null,
      cooldownSeconds,
    });

    if (!applied) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Chat moderation is not configured.' },
        { status: 503 },
      );
    }

    await insertBeaconAudit({
      actorId: gate.auth.userId,
      command: 'beacon.event.moderate',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: action === 'slow_mode' ? 'channel' : 'member',
      targetId: body.targetUserId ?? event.id,
      metadata: { action, cooldownSeconds },
    });

    return NextResponse.json({ ok: true, status: 'applied' }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'moderate', extra: { eventId: id } });
    return beaconErrorResponse('Could not apply moderation.');
  }
}
