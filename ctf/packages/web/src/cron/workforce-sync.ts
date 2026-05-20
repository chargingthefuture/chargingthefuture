import { getObservabilityReporter } from 'lib/observability/provider';

const WORKFORCE_INCREMENTAL_SYNC_MONITOR_SLUG = 'workforce-incremental-sync';

export async function executeWorkforceSyncCron(): Promise<void> {
  const reporter = await getObservabilityReporter();
  const checkInId = await reporter.captureCronCheckIn({
    monitorSlug: WORKFORCE_INCREMENTAL_SYNC_MONITOR_SLUG,
    status: 'in_progress',
  });

  try {
    // The cron runs inside the web service and calls that same service's
    // internal endpoint, so a loopback call on the service PORT is correct on
    // Render (and locally). Plain HTTP — the request never leaves the host.
    const port = process.env.PORT || '3000';
    const url = `http://localhost:${port}/api/workforce/internal/sync`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`,
      },
      body: JSON.stringify({
        batchSize: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Workforce sync endpoint returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[Cron] Workforce sync completed:', result);

    await reporter.captureCronCheckIn({
      monitorSlug: WORKFORCE_INCREMENTAL_SYNC_MONITOR_SLUG,
      status: 'ok',
      checkInId,
    });
  } catch (error) {
    console.error('[Cron] Workforce sync failed:', error);

    await reporter.captureCronCheckIn({
      monitorSlug: WORKFORCE_INCREMENTAL_SYNC_MONITOR_SLUG,
      status: 'error',
      checkInId,
    });

    throw error;
  }
}

export async function scheduleWorkforceSyncCron() {
  // Dynamic import to avoid loading node-cron in edge runtime
  const cron = await import('node-cron');

  // Schedule: Every 4 hours (0 */4 * * *)
  const task = cron.schedule('0 */4 * * *', executeWorkforceSyncCron, {
    timezone: 'UTC',
  });

  console.log('[Cron] Workforce sync cron scheduled (0 */4 * * * UTC)');

  return task;
}
