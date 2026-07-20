import { NextResponse } from 'next/server';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { createEvent, listEventsForAdmin } from 'lib/mutual-time/repository';
import { logMutualTimeAudit } from 'lib/mutual-time/audit';
import { reportError } from 'lib/observability/report';
import { requireMutualTimeAdmin, ensureMutationCsrf, mutualTimeErrorResponse } from '../_lib';

// GET /api/mutual-time/events — the admin's own events (dashboard list). Admin-only.
export async function GET() {
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
