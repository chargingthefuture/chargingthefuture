import { NextResponse } from 'next/server';
import { getReaderList } from 'lib/what-works/repository';
import { requireWhatWorksAccess, whatWorksError } from './_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';
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
      command: 'what-works.list.read',
      status: 'allow',
      reason: 'access_route_guard',
      targetType: 'list',
      targetId: 'shared',
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, ...list, viewer: { isAdmin: gate.auth.isAdmin } });
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'index' });
    return whatWorksError('What Works is unavailable right now.', 'what_works_unavailable', 500);
  }
}
