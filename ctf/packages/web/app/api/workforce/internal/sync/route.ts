import { NextResponse } from 'next/server';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { getObservabilityReporter } from 'lib/observability/provider';
import { runIncrementalRecruitedSync } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

type SyncBody = {
  batchSize?: number;
};

const WORKFORCE_INCREMENTAL_SYNC_MONITOR_SLUG = 'workforce-incremental-sync';

function isAuthorized(request: Request): boolean {
  const configuredToken = process.env.WORKFORCE_SYNC_TOKEN;
  const configuredCronSecret = process.env.CRON_SECRET;

  const authorizationHeader = request.headers.get('authorization') ?? '';
  if (configuredCronSecret && configuredCronSecret.trim().length > 0) {
    const expectedBearer = `Bearer ${configuredCronSecret}`;
    if (authorizationHeader === expectedBearer) {
      return true;
    }
  }

  if (!configuredToken || configuredToken.trim().length === 0) {
    return false;
  }

  const providedToken = request.headers.get('x-workforce-sync-token') ?? '';
  return providedToken.length > 0 && providedToken === configuredToken;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidSyncToken, message: 'Invalid workforce sync token.' },
      { status: 403 },
    );
  }

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    body = {};
  }

  try {
    const reporter = await getObservabilityReporter();
    const checkInId = await reporter.captureCronCheckIn({
      monitorSlug: WORKFORCE_INCREMENTAL_SYNC_MONITOR_SLUG,
      status: 'in_progress',
    });

    try {
      const result = await runIncrementalRecruitedSync(null, {
        batchSize: Number.isFinite(body.batchSize) ? Number(body.batchSize) : undefined,
        source: 'internal_token_sync',
      });

      await reporter.captureCronCheckIn({
        monitorSlug: WORKFORCE_INCREMENTAL_SYNC_MONITOR_SLUG,
        status: 'ok',
        checkInId,
      });

      return NextResponse.json({ ok: true, ...result }, { status: 200 });
    } catch (error) {
      reportError(error, { area: 'workforce', op: 'internal_sync' });
      await reporter.captureCronCheckIn({
        monitorSlug: WORKFORCE_INCREMENTAL_SYNC_MONITOR_SLUG,
        status: 'error',
        checkInId,
      });

      return NextResponse.json(
        { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to run internal incremental sync.' },
        { status: 503 },
      );
    }
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'internal_sync' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to run internal incremental sync.' },
      { status: 503 },
    );
  }
}
