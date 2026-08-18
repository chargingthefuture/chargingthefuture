import { NextRequest, NextResponse } from 'next/server';
import { deleteIncident, getIncidentById, setIncidentShared } from 'lib/click-log/repository';
import { canDeleteIncident, canToggleIncidentShare } from 'lib/click-log/policy';
import { logClickLogAudit } from 'lib/click-log/audit';
import { ensureMutationCsrf, requireClickLogAccess } from '../_lib';
import { failureReason } from 'lib/errors/failure';
import { applyIncidentEdit, authorizeEdit, parseEditBody, validateEditRules } from './_edit';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrfDenied = ensureMutationCsrf(request);
  if (csrfDenied) {
    return csrfDenied;
  }
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id param' }, { status: 400 });
  }
  // Fetch the incident directly by id
  const incident = await getIncidentById(id);
  if (!incident) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }
  if (!incident.user_id) {
    return NextResponse.json({ error: 'Incident has no owner' }, { status: 500 });
  }
  if (!canDeleteIncident(gate.auth.userId, incident.user_id, gate.auth.isAdmin)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const deleted = await deleteIncident(id, gate.auth.userId, gate.auth.isAdmin);
  if (!deleted) {
    // The request was authorized but the row was gone (rowCount 0 — e.g. a concurrent
    // delete). The audit contract requires an event for every authorized operation, so
    // log the failure result here rather than only on the success path below.
    logClickLogAudit({
      actorId: gate.auth.userId,
      command: 'click-log.incident.delete',
      result: 'failure',
      target: { incidentId: id },
    });
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
  logClickLogAudit({
    actorId: gate.auth.userId,
    command: 'click-log.incident.delete',
    result: 'success',
    target: { incidentId: id },
  });
  return NextResponse.json({ success: true });
}

// Reads and validates the PATCH body: { sharedWithOwner: boolean }. Extracted so the handler's
// branch count stays under the rule-116 complexity limit.
async function parseShareBody(request: NextRequest): Promise<{ error: NextResponse } | { shared: boolean }> {
  let body;
  try {
    body = await request.json();
  } catch (caught) {
    return { error: NextResponse.json({ error: 'Invalid JSON body', reason: failureReason(caught) }, { status: 400 }) };
  }
  const shared = (body as { sharedWithOwner?: unknown })?.sharedWithOwner;
  if (typeof shared !== 'boolean') {
    return { error: NextResponse.json({ error: 'Invalid sharedWithOwner' }, { status: 400 }) };
  }
  return { shared };
}

// Authorization + rule check for a share change: only the member who logged the incident may
// change it, and a tagged incident may not be made private (owner decision, 2026-08-18: tags
// exist to feed the trend data, so an incident can be private only when untagged — turning
// sharing ON stays allowed on any incident). Extracted so PATCH stays under the rule-116
// complexity limit. Returns null when the change may proceed.
function denyShareChange(
  userId: string,
  incident: { user_id: string | null; problem_tags: string[]; scheme_tags: string[] },
  shared: boolean,
): NextResponse | null {
  if (!incident.user_id || !canToggleIncidentShare(userId, incident.user_id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (!shared && (incident.problem_tags.length > 0 || incident.scheme_tags.length > 0)) {
    return NextResponse.json(
      { error: 'A tagged incident always shares trend data with the owner — remove its tags first to make it private' },
      { status: 400 },
    );
  }
  return null;
}

// Toggles whether a single incident is shared with the owner. Only the member who logged the
// incident may change it (canToggleIncidentShare — deliberately no admin override: consent belongs
// to the member alone). Body: { sharedWithOwner: boolean }.
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrfDenied = ensureMutationCsrf(request);
  if (csrfDenied) {
    return csrfDenied;
  }
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id param' }, { status: 400 });
  }
  const parsed = await parseShareBody(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const shared = parsed.shared;
  const incident = await getIncidentById(id);
  if (!incident) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }
  const denied = denyShareChange(gate.auth.userId, incident, shared);
  if (denied) {
    return denied;
  }
  const updated = await setIncidentShared(id, gate.auth.userId, shared);
  if (!updated) {
    logClickLogAudit({
      actorId: gate.auth.userId,
      command: 'click-log.incident.share.set',
      result: 'failure',
      target: { incidentId: id },
    });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
  logClickLogAudit({
    actorId: gate.auth.userId,
    command: 'click-log.incident.share.set',
    result: 'success',
    target: { incidentId: id, sharedWithOwner: String(shared) },
  });
  return NextResponse.json({ success: true, sharedWithOwner: shared });
}

// Edits an incident's note and tags (owner decision, 2026-08-13). The date and location are
// immutable — they anchor the trend data and a location cannot be truthfully added after the
// fact — so the body carries only { notes, problemTags, schemeTags }; a null note clears it
// and an absent/empty tag list untags that kind.
// Only the member who logged the incident may edit it (authorizeEdit — no admin override).
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrfDenied = ensureMutationCsrf(request);
  if (csrfDenied) {
    return csrfDenied;
  }
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id param' }, { status: 400 });
  }
  const parsed = await parseEditBody(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const incident = await getIncidentById(id);
  if (!incident) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }
  const authDenied = authorizeEdit(gate.auth.userId, incident);
  if (authDenied) {
    return authDenied;
  }
  const ruleDenied = validateEditRules(incident, parsed.data);
  if (ruleDenied) {
    return ruleDenied;
  }
  const outcome = await applyIncidentEdit(id, gate.auth.userId, parsed.data);
  if (outcome !== 'ok') {
    logClickLogAudit({
      actorId: gate.auth.userId,
      command: 'click-log.incident.update',
      result: 'failure',
      target: { incidentId: id },
    });
    return outcome === 'conflict'
      ? NextResponse.json(
          { error: 'Another of your incidents already has this exact note and location — change the note slightly' },
          { status: 409 },
        )
      : NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
  logClickLogAudit({
    actorId: gate.auth.userId,
    command: 'click-log.incident.update',
    result: 'success',
    target: { incidentId: id },
  });
  return NextResponse.json({ success: true });
}
