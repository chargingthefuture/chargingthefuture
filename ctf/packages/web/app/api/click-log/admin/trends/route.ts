import { NextResponse } from 'next/server';
import { buildSharedIncidentReport } from 'lib/click-log/report';
import { canViewSharedTrends } from 'lib/click-log/policy';
import { logClickLogAudit } from 'lib/click-log/audit';
import { requireClickLogAdminAccess } from '../../_lib';

// Owner/admin-only aggregate trends over incidents members opted to share. Every repository query
// behind this returns only coarse data (UTC day, ~11 km location cell, counts, canonical tag
// slugs, and distinct-member counts) — notes, precise coordinates, incident ids, and member
// identity are excluded at the SQL layer, so nothing member-identifying can leak through this
// endpoint.
//
// `buckets` and `tagTrends` are the original response and are unchanged. The rest of the report
// (summary, areas, categories, pairs) was added so the screen can show where activity is and how
// many different members are behind it, and so the shareable image gives an outside reader
// something they can follow.
export async function GET() {
  const gate = await requireClickLogAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  if (!canViewSharedTrends(gate.auth.isAdmin)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const report = await buildSharedIncidentReport();
  logClickLogAudit({ actorId: gate.auth.userId, command: 'click-log.trends.fetch', result: 'success' });
  return NextResponse.json(report);
}
