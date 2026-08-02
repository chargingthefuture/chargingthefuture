import { NextResponse } from 'next/server';
import { getSharedIncidentTagTrends, getSharedIncidentTrends } from 'lib/click-log/repository';
import { canViewSharedTrends } from 'lib/click-log/policy';
import { logClickLogAudit } from 'lib/click-log/audit';
import { requireClickLogAdminAccess } from '../../_lib';

// Owner/admin-only aggregate trends over incidents members opted to share. The repository
// queries return only coarse data (UTC day + ~11 km location cell + count buckets, and
// per-tag counts over the canonical tag slugs) — notes, precise coordinates, incident ids,
// and member identity are excluded at the SQL layer, so nothing member-identifying can leak
// through this endpoint.
export async function GET() {
  const gate = await requireClickLogAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  if (!canViewSharedTrends(gate.auth.isAdmin)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const buckets = await getSharedIncidentTrends();
  const tagTrends = await getSharedIncidentTagTrends();
  logClickLogAudit({ actorId: gate.auth.userId, command: 'click-log.trends.fetch', result: 'success' });
  return NextResponse.json({ buckets, tagTrends });
}
