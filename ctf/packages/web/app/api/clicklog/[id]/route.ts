import { NextRequest, NextResponse } from 'next/server';
import { deleteIncident, getIncidentById } from 'lib/clicklog/repository';
import { canDeleteIncident } from 'lib/clicklog/policy';
import { requireClicklogAccess } from '../_lib';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireClicklogAccess();
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
  const deleted = await deleteIncident(id, gate.auth.userId);
  if (!deleted) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
