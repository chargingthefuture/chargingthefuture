import { NextResponse } from 'next/server';
import { getReaderList } from 'lib/whatworks/repository';
import { requireWhatWorksAccess, whatworksError } from './_lib';
import { logWhatWorksAudit } from 'lib/whatworks/audit';
import { reportError } from 'lib/observability/report';

// Full shared list for an authenticated survivor, with per-row endorsement state.
export async function GET() {
  const gate = await requireWhatWorksAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  try {
    const list = await getReaderList(gate.auth.userId);
    logWhatWorksAudit({
      actorId: gate.auth.userId,
      command: 'whatworks.list.read',
      status: 'allow',
      reason: 'access_route_guard',
      targetType: 'list',
      targetId: 'shared',
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, ...list, viewer: { isAdmin: gate.auth.isAdmin } });
  } catch (error) {
    reportError(error, { area: 'whatworks', op: 'index' });
    return whatworksError('What Works is unavailable right now.', 'whatworks_unavailable', 500);
  }
}
