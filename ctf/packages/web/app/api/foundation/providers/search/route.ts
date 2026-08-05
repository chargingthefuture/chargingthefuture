import { NextRequest, NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit, searchProviders } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: NextRequest) {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') ?? '';
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '20', 10);
    // Optional filter: only providers who have opted in to offer this specific skill. Must be a
    // UUID; anything else is ignored so a malformed value can't reach the ::uuid cast and 503.
    const skillIdRaw = searchParams.get('skillId');
    const skillId = skillIdRaw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(skillIdRaw)
      ? skillIdRaw
      : null;

    // viewerUserId hides providers in a blocked pair with the browsing member (issue #809 task 4).
    const providers = await searchProviders({ query, skillId, page, pageSize, viewerUserId: gate.auth.userId });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.search.providers',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'provider_search',
      targetId: query || 'all',
      metadata: { page: providers.pagination.page, pageSize: providers.pagination.pageSize, total: providers.total },
    });

    // Return the viewer's own id so the client can suppress the "Connect now" button on the
    // viewer's own provider card (you can't ring yourself). The provider items already carry the
    // read-only instant-call availability mirror (Foundation "Connect now", issue #808).
    return NextResponse.json({ ok: true, viewerUserId: gate.auth.userId, ...providers }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'providers_search' });
    console.error('[Foundation] Provider search failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Provider search unavailable.' },
      { status: 503 },
    );
  }
}
