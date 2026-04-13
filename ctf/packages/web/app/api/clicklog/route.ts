
import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestIdentity } from 'lib/auth/request-identity';
import { createIncident, getIncidentsByUser, getIncidentCount } from 'lib/clicklog/repository';
import { canCreateIncident } from 'lib/clicklog/policy';
import { MAX_NOTES_LENGTH } from 'lib/clicklog/constants';

export async function GET(req: NextRequest) {
  const identity = await resolveRequestIdentity();
  if (!identity.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const incidents = await getIncidentsByUser(identity.userId);
  const count = await getIncidentCount(identity.userId);
  return NextResponse.json({ incidents, count });
}

export async function POST(req: NextRequest) {
  const identity = await resolveRequestIdentity();
  if (!identity.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!canCreateIncident(identity.userId)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.metadata) {
    return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
  }
  const metadata = body.metadata;
  if (metadata.latitude !== undefined) {
    if (typeof metadata.latitude !== 'number' || !Number.isFinite(metadata.latitude) || metadata.latitude < -90 || metadata.latitude > 90) {
      return NextResponse.json({ error: 'Invalid latitude' }, { status: 400 });
    }
  }
  if (metadata.longitude !== undefined) {
    if (typeof metadata.longitude !== 'number' || !Number.isFinite(metadata.longitude) || metadata.longitude < -180 || metadata.longitude > 180) {
      return NextResponse.json({ error: 'Invalid longitude' }, { status: 400 });
    }
  }
  if (metadata.notes && metadata.notes.length > MAX_NOTES_LENGTH) {
    return NextResponse.json({ error: 'Notes too long' }, { status: 400 });
  }
  const incident = await createIncident({ userId: identity.userId, metadata });
  return NextResponse.json({ incident });
}
// (all logic is now inside GET/POST handlers)
