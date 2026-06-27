import { NextResponse } from 'next/server';
import { requireGentlePulseReadAccess } from 'lib/gentle-pulse/_lib';
import { listLibraryItems } from 'lib/gentle-pulse/repository';
import { logGentlePulseAudit } from 'lib/gentle-pulse/audit';

const COMMAND = 'gentle-pulse.library.list';

function parseIntParam(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const gate = await requireGentlePulseReadAccess();
  if ('response' in gate) {
    logGentlePulseAudit({
      actorId: null,
      command: COMMAND,
      status: 'deny',
      reason: 'access_denied',
      result: 'failure',
      errorCategory: 'authz',
    });
    return gate.response;
  }

  const url = new URL(request.url);
  const items = await listLibraryItems({
    userId: gate.auth.userId,
    sort: url.searchParams.get('sort'),
    favoritesOnly: url.searchParams.get('favoritesOnly') === 'true',
    limit: parseIntParam(url.searchParams.get('limit')),
    offset: parseIntParam(url.searchParams.get('offset')),
  });

  logGentlePulseAudit({
    actorId: gate.auth.userId,
    command: COMMAND,
    status: 'allow',
    reason: 'policy_pass',
    result: 'success',
    metadata: { total: items.total },
  });

  return NextResponse.json({ ok: true, items: items.items, total: items.total }, { status: 200 });
}
