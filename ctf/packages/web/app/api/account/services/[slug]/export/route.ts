import { NextResponse } from 'next/server';
import { requireAccountAccess } from '../../../_lib';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { getDeletionEntry } from 'lib/account/deletion-registry';
import { exportServiceData } from 'lib/account/export-orchestrator';
import { UnknownServiceError } from 'lib/account/deletion-orchestrator';
import { logAccountAudit } from 'lib/account/audit';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';

// Per-service JSON data export — the read-side twin of DELETE /api/account/services/:slug
// (issue #1264). Returns every row of this member's own data held by one service, as a
// downloadable, self-describing JSON file. Read-only; nothing is changed.
//
// Unlike the delete route this does NOT require `serviceScopeSupported` — that flag is about
// standalone deletion semantics. Any registry slug can be exported; a service with nothing
// user-scoped (aggregate-only or all-retained) returns an honest envelope with zero tables.
//
// A member can only ever export their own data: the registry-derived SELECTs always bind the
// authenticated user id as $1 (validated without a DB by ctf/scripts/check-export-engine.mjs).
// Every export is audited (a data-access event) and rate-limited per user (a multi-table read).
//
// GET /api/account/services/:slug/export
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { slug } = await context.params;
  const entry = getDeletionEntry(slug);
  if (!entry) {
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.unknownService, message: `Unknown service "${slug}".` },
      { status: 404 },
    );
  }

  // Per-user brake: an export is a heavy multi-table read, so bound how often one member can pull
  // it. Keyed by user id (the route is auth-gated, so the key cannot be spoofed via headers).
  const limit = checkRateLimit(`account-export:service:${gate.auth.userId}`, 10, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.rateLimited, message: 'Too many exports. Wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const document = await exportServiceData(slug, gate.auth.userId);
    const totalRows = document.services.reduce(
      (sum, service) => sum + service.tables.reduce((s, t) => s + t.rowCount, 0),
      0,
    );

    logAccountAudit({
      command: 'account.data.export.service',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'self_service_export',
      scope: 'service',
      serviceName: slug,
      result: 'success',
      errorCategory: null,
      metadata: { tables: document.services[0]?.tables.length ?? 0, totalRows },
    });

    const date = document.generatedAtIso.slice(0, 10);
    return NextResponse.json(document, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="ctf-account-data-${slug}-${date}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    reportError(error, { area: 'account', op: 'services_slug_export' });
    if (error instanceof UnknownServiceError) {
      return NextResponse.json(
        { ok: false, code: ACCOUNT_ERROR_CODE.unknownService, message: `Unknown service "${slug}".` },
        { status: 404 },
      );
    }
    logAccountAudit({
      command: 'account.data.export.service',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'self_service_export',
      scope: 'service',
      serviceName: slug,
      result: 'failure',
      errorCategory: 'persistence',
    });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to export ${slug} data.` },
      { status: 503 },
    );
  }
}
