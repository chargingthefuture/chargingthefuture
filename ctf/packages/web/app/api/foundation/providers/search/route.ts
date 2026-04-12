import { NextRequest, NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { insertFoundationAudit, searchProviders } from 'lib/foundation/repository';

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

    const providers = await searchProviders({ query, page, pageSize });

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.search.providers',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'provider_search',
      targetId: query || 'all',
      metadata: { page: providers.pagination.page, pageSize: providers.pagination.pageSize, total: providers.total },
    });

    return NextResponse.json({ ok: true, ...providers }, { status: 200 });
  } catch (error) {
    console.error('[Foundation] Provider search failed:', error);
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Provider search unavailable.' },
      { status: 503 },
    );
  }
}
