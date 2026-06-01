import { NextResponse } from 'next/server';
import { getReaderList } from 'lib/whatworks/repository';
import { requireWhatWorksAccess, whatworksError } from './_lib';
import { reportError } from 'lib/observability/report';

// Full shared list for an authenticated survivor, with per-row endorsement state.
export async function GET() {
  const gate = await requireWhatWorksAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  try {
    const list = await getReaderList(gate.auth.userId);
    return NextResponse.json({ ok: true, ...list, viewer: { isAdmin: gate.auth.isAdmin } });
  } catch (error) {
    reportError(error, {
      area: 'whatworks',
      op: 'get_reader_list',
      extra: { userId: gate.auth.userId },
    });
    return whatworksError('What Works is unavailable right now.', 'whatworks_unavailable', 500);
  }
}
