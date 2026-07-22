import { NextResponse } from 'next/server';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { createEvent, listEventsForAdmin } from 'lib/mutual-time/repository';
import { logMutualTimeAudit } from 'lib/mutual-time/audit';
import { reportError } from 'lib/observability/report';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { requireMutualTimeAdmin, ensureMutationCsrf, mutualTimeErrorResponse } from '../_lib';

// Route convention (deliberate): admin surfaces are keyed by event id under the plural
// /api/mutual-time/events/* (create, list, close), while the public shareable surface is keyed by
// slug under the singular /api/mutual-time/event/[slug]/*. Slugs are the member-facing, guessable-free
// share token; ids are the internal admin handle.

// GET /api/mutual-time/events — the admin's own events (dashboard list). Admin-only. Adds a
// same-origin check (in addition to the admin gate) so a credentialed cross-origin page cannot read
// the admin's event list (slugs, voter counts). Missing-Origin same-origin requests still pass.
export async function GET(request: Request) {
  const originCheck = checkMutationOrigin(request);
  if (originCheck !== 'allow') {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.csrfDenied, message: 'Cross-origin read denied.' },
      { status: 403 },
    );
  }
  const gate = await requireMutualTimeAdmin();
  if (!gate.allowed) {
    return gate.response;
  }
  try {
    const events = await listEventsForAdmin(gate.auth.userId);
    return NextResponse.json({ ok: true, events }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'mutual-time', op: 'events_list', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.persistenceUnavailable, message: 'Unable to load events.' },
      { status: 503 },
    );
  }
}

// POST /api/mutual-time/events — create an event (one shareable link). Admin-only.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }
  const gate = await requireMutualTimeAdmin();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.invalidPayload, message: 'Invalid request body.' },
      { status: 400 },
    );
  }

  try {
    const event = await createEvent(gate.auth.userId, {
      title: body.title,
      description: body.description,
      meetingPlugin: body.meetingPlugin,
      opensAt: body.opensAt,
      closesAt: body.closesAt,
    });
    logMutualTimeAudit({
      pluginId: 'mutual-time',
      command: 'mutual-time.event.create',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin',
      evidence: 'role=admin',
      target: { eventId: event.id, slug: event.slug, meetingPlugin: event.meetingPlugin },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, event }, { status: 200 });
  } catch (error) {
    const mapped = mutualTimeErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'mutual-time', op: 'event_create', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.internalError, message: 'Unable to create the event.' },
      { status: 500 },
    );
  }
}
