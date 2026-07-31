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

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

// Validate a latitude value that is present in the incident metadata.
function invalidLatitude(latitude: unknown): boolean {
  return typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90;
}

// Validate a longitude value that is present in the incident metadata.
function invalidLongitude(longitude: unknown): boolean {
  return typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180;
}

// Trim notes before validating and storing so trailing/leading whitespace can't push a note past the
// limit (or be stored unnormalised). Drop an empty trimmed note. Returns undefined when absent.
function parseNotes(raw: unknown): { error: NextResponse } | { data: string | undefined } {
  if (raw === undefined) {
    return { data: undefined };
  }
  if (typeof raw !== 'string') {
    return { error: badRequest('Invalid notes') };
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_NOTES_LENGTH) {
    return { error: badRequest('Notes too long') };
  }
  return { data: trimmed.length > 0 ? trimmed : undefined };
}

// Validate and normalise the optional incident metadata. metadata is optional per the command
// contract; a client that omits it (or sends an empty body) defaults to {} rather than a 400.
// Returns a discriminated result so the caller keeps TypeScript narrowing.
function parseIncidentMetadata(rawBody: unknown): { error: NextResponse } | { data: IncidentMetadata } {
  const rawMetadata = (rawBody as { metadata?: unknown })?.metadata ?? {};
  if (typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    return { error: badRequest('Invalid metadata') };
  }
  const meta = rawMetadata as { latitude?: unknown; longitude?: unknown; notes?: unknown };
  if (meta.latitude !== undefined && invalidLatitude(meta.latitude)) {
    return { error: badRequest('Invalid latitude') };
  }
  if (meta.longitude !== undefined && invalidLongitude(meta.longitude)) {
    return { error: badRequest('Invalid longitude') };
  }
  const notesResult = parseNotes(meta.notes);
  if ('error' in notesResult) {
    return notesResult;
  }
  return { data: buildMetadata(meta, notesResult.data) };
}

// Assemble the incident metadata, including only the fields that were provided so an omitted field is
// stored as absent rather than as null/undefined.
function buildMetadata(
  meta: { latitude?: unknown; longitude?: unknown },
  notes: string | undefined,
): IncidentMetadata {
  return {
    ...(meta.latitude !== undefined ? { latitude: meta.latitude as number } : {}),
    ...(meta.longitude !== undefined ? { longitude: meta.longitude as number } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
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
  const parsed = parseIncidentMetadata(body);
  if ('error' in parsed) {
    return parsed.error;
  }
  const metadata = parsed.data;
  const incident = await createIncident({ userId, metadata });
  logClickLogAudit({ actorId: userId, command: 'click-log.incident.create', result: 'success' });
  // Return the incident flat to match the command contract's outputSchema
  // (ClickLogIncident, not a { incident } wrapper). No current caller reads this body,
  // so unwrapping here aligns the route with the contract without breaking a reader.
  return NextResponse.json(incident);
}
