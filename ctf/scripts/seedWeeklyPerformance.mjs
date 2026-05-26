
import { queryDb } from '../packages/web/lib/db/postgres.ts';
import crypto from 'crypto';

const WEEK_START = '2026-05-19';

const METRICS = [
  { key: 'engagement.daily_active', value: 892, unit: 'users' },
  { key: 'engagement.posts_created', value: 342, unit: 'posts' },
  { key: 'retention.week_over_week', value: 87.5, unit: 'percent' },
  { key: 'performance.page_load_time', value: 1.2, unit: 'seconds' },
  { key: 'performance.error_rate', value: 0.03, unit: 'percent' },
];

function deterministicWeekId(weekDate) {
  return crypto.createHash('sha256').update('week-' + weekDate).digest('hex').slice(0, 32);
}

function deterministicMetricId(weekDate, metricKey, sourcePlugin) {
  return crypto.createHash('sha256').update(weekDate + metricKey + sourcePlugin).digest('hex').slice(0, 32);
}

async function seed() {
  await queryDb('BEGIN');
  try {
    // Seed week record
    const weekId = deterministicWeekId(WEEK_START);
    await queryDb(
      `INSERT INTO weekly_performance_weeks (id, week_start_date, summary)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [
        weekId,
        WEEK_START,
        'Week ending ' + WEEK_START + ': strong engagement and retention metrics',
      ]
    );

    // Seed metrics
    for (const metric of METRICS) {
      const metricId = deterministicMetricId(WEEK_START, metric.key, 'analytics');
      await queryDb(
        `INSERT INTO weekly_performance_metrics
         (id, week_start_date, metric_key, metric_value, metric_unit, source_plugin)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          metricId,
          WEEK_START,
          metric.key,
          metric.value,
          metric.unit,
          'analytics',
        ]
      );
    }

    await queryDb('COMMIT');
    console.log('Seeded weekly performance weeks and metrics.');
  } catch (err) {
    try {
      await queryDb('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    throw err;
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
