import { NextResponse } from 'next/server';
import { requireAccountAccess } from '../../_lib';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { exportAllAccountData } from 'lib/account/export-orchestrator';
import { logAccountAudit } from 'lib/account/audit';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';

// Whole-account JSON data export — the read-side twin of DELETE /api/account/full-account
// (issue #1264). Walks every service in the account deletion registry and returns all of this
// member's own rows in one downloadable, self-describing JSON document (one consistent snapshot —
// the whole read runs in a single transaction). Read-only; nothing is changed.
//
// A member can only ever export their own data: the registry-derived SELECTs always bind the
// authenticated user id as $1 (validated without a DB by ctf/scripts/check-export-engine.mjs).
// Every export is audited (a data-access event) and rate-limited per user — the full export reads
// every user-scoped table in the registry, so its brake is tighter than the per-service one.
//
// GET /api/account/full-account/export
export async function GET() {
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limit = checkRateLimit(`account-export:full:${gate.auth.userId}`, 3, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.rateLimited, message: 'Too many exports. Wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const document = await exportAllAccountData(gate.auth.userId);
    const totalRows = document.services.reduce(
      (sum, service) => sum + service.tables.reduce((s, t) => s + t.rowCount, 0),
      0,
    );

    logAccountAudit({
      command: 'account.data.export.full',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'self_service_export',
      scope: 'account',
      result: 'success',
      errorCategory: null,
      metadata: { services: document.services.length, totalRows },
    });

    const date = document.generatedAtIso.slice(0, 10);
    return NextResponse.json(document, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="ctf-account-data-full-account-${date}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    reportError(error, { area: 'account', op: 'full_account_export' });
    logAccountAudit({
      command: 'account.data.export.full',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'self_service_export',
      scope: 'account',
      result: 'failure',
      errorCategory: 'persistence',
    });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to export your account data.' },
      { status: 503 },
    );
  }
}
