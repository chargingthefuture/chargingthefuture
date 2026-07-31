import { NextRequest, NextResponse } from 'next/server';
import { createIncident, getIncidentsByUser, getIncidentCount } from 'lib/click-log/repository';
import { MAX_NOTES_LENGTH } from 'lib/click-log/constants';
import { canViewIncidents } from 'lib/click-log/policy';
import { logClickLogAudit } from 'lib/click-log/audit';
import type { IncidentMetadata } from 'lib/click-log/types';
import { requireClickLogAccess } from './_lib';

export async function GET() {
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const userId = gate.auth.userId;
  // The userId is always the caller's own id, so this guard is satisfied today, but
  // calling the policy function keeps the access decision active and auditable (and
  // enforces the contract's mustMatch attribute policy) rather than leaving it as dead
  // code that a future admin-list path could bypass.
  if (!canViewIncidents(gate.auth.userId, userId, gate.auth.isAdmin)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const incidents = await getIncidentsByUser(userId);
  const count = await getIncidentCount(userId);
  logClickLogAudit({ actorId: userId, command: 'click-log.incident.list', result: 'success' });
  return NextResponse.json({ incidents, count });
}

export async function POST(req: NextRequest) {
  const gate = await requireClickLogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const userId = gate.auth.userId;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  // metadata is optional per the command contract; default it to {} so a client that
  // omits it (or sends an empty body) is not rejected with a spurious 400.
  const rawMetadata = body.metadata ?? {};
  if (typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
  }
  if (rawMetadata.latitude !== undefined) {
    if (typeof rawMetadata.latitude !== 'number' || !Number.isFinite(rawMetadata.latitude) || rawMetadata.latitude < -90 || rawMetadata.latitude > 90) {
      return NextResponse.json({ error: 'Invalid latitude' }, { status: 400 });
    }
  }
  if (rawMetadata.longitude !== undefined) {
    if (typeof rawMetadata.longitude !== 'number' || !Number.isFinite(rawMetadata.longitude) || rawMetadata.longitude < -180 || rawMetadata.longitude > 180) {
      return NextResponse.json({ error: 'Invalid longitude' }, { status: 400 });
    }
  }
  // Trim notes before validating and storing so trailing/leading whitespace can't push
  // a note past the limit (or be stored unnormalized). Drop an empty trimmed note.
  let notes: string | undefined;
  if (rawMetadata.notes !== undefined) {
    if (typeof rawMetadata.notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
    }
    const trimmed = rawMetadata.notes.trim();
    if (trimmed.length > MAX_NOTES_LENGTH) {
      return NextResponse.json({ error: 'Notes too long' }, { status: 400 });
    }
    notes = trimmed.length > 0 ? trimmed : undefined;
  }
  const metadata: IncidentMetadata = {
    ...(rawMetadata.latitude !== undefined ? { latitude: rawMetadata.latitude } : {}),
    ...(rawMetadata.longitude !== undefined ? { longitude: rawMetadata.longitude } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  const incident = await createIncident({ userId, metadata });
  logClickLogAudit({ actorId: userId, command: 'click-log.incident.create', result: 'success' });
  // Return the incident flat to match the command contract's outputSchema
  // (ClickLogIncident, not a { incident } wrapper). No current caller reads this body,
  // so unwrapping here aligns the route with the contract without breaking a reader.
  return NextResponse.json(incident);
}
