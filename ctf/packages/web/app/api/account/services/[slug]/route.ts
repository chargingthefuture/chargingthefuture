import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../../_lib';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { getDeletionEntry } from 'lib/account/deletion-registry';
import {
  deleteServiceScopeData,
  ServiceScopeNotSupportedError,
} from 'lib/account/deletion-orchestrator';

// Generic per-plugin "delete my data for this service" endpoint.
//
// One route handles every service-scoped plugin instead of a hand-written file per plugin: the
// `[slug]` is validated against the account deletion registry (which is itself validated against
// the database schema in CI), and the registry-driven orchestrator performs the deletion in a
// single transaction. Plugins that have no standalone deletion (money/aggregate-only, e.g.
// ServiceCredits, GDP, Weekly Performance) return a clear 4xx rather than a silent no-op.
//
// DELETE /api/account/services/:slug
export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { slug } = await context.params;
  const entry = getDeletionEntry(slug);
  if (!entry) {
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.unknownService, message: `Unknown service "${slug}".` },
      { status: 404 },
    );
  }
  if (!entry.serviceScopeSupported) {
    return NextResponse.json(
      {
        ok: false,
        code: ACCOUNT_ERROR_CODE.serviceScopeUnsupported,
        message: `Service "${slug}" cannot be deleted on its own; it is settled only as part of full-account deletion.`,
      },
      { status: 409 },
    );
  }

  try {
    const result = await deleteServiceScopeData(slug, gate.auth.userId);
    return NextResponse.json(
      {
        ok: true,
        scope: 'service',
        service: result.serviceName,
        status: 'completed',
        requestedAtIso: result.requestedAtIso,
        tablesAffected: result.tables.length,
      },
      { status: 200 },
    );
  } catch (error) {
    // The orchestrator already rejects unsupported plugins, but guard here too for safety.
    if (error instanceof ServiceScopeNotSupportedError) {
      return NextResponse.json(
        {
          ok: false,
          code: ACCOUNT_ERROR_CODE.serviceScopeUnsupported,
          message: `Service "${slug}" cannot be deleted on its own.`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: ACCOUNT_ERROR_CODE.persistenceUnavailable,
        message: `Unable to delete ${slug} data.`,
      },
      { status: 503 },
    );
  }
}
