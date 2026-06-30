import { NextResponse } from 'next/server';
import { requireFoundationReadAccess } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { getProviderById, insertFoundationAudit } from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

// One Foundation provider by directory-profile id, behind the same read gate as search. Backs the
// auth-gated deep-link page (/apps/foundation/provider/[id]) so a shared link opens that provider
// for a signed-in member; unauthenticated visitors never reach this (the gate denies, and the page
// redirects them to the Foundation landing). 404 when the id matches no active provider.
export async function GET(request: Request, context: { params: Promise<{ providerId: string }> }) {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { providerId } = await context.params;

  try {
    const provider = await getProviderById(providerId);

    await insertFoundationAudit({
      actorId: gate.auth.userId,
      command: 'foundation.provider.get',
      policyStatus: 'allow',
      reason: provider ? 'ok' : 'not_found',
      targetType: 'provider_profile',
      targetId: providerId,
      metadata: { found: provider !== null },
    });

    if (!provider) {
      return NextResponse.json(
        { ok: false, code: FOUNDATION_ERROR_CODE.providerNotFound, message: "This provider's profile could not be found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, viewerUserId: gate.auth.userId, provider }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'get_provider' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Provider profile unavailable.' },
      { status: 503 },
    );
  }
}
