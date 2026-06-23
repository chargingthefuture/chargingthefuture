import { NextRequest, NextResponse } from 'next/server';
import { createIncident, getIncidentsByUser, getIncidentCount } from 'lib/clicklog/repository';
import { MAX_NOTES_LENGTH } from 'lib/clicklog/constants';
import { requireClicklogAccess } from './_lib';

export async function GET() {
  const gate = await requireClicklogAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const userId = gate.auth.userId;
  const incidents = await getIncidentsByUser(userId);
  const count = await getIncidentCount(userId);
  return NextResponse.json({ incidents, count });
}

export async function POST(req: NextRequest) {
  const gate = await requireClicklogAccess();
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
  const incident = await createIncident({ userId, metadata });
  return NextResponse.json({ incident });
}
