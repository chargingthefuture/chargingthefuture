import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';

type PublicationRow = {
  id: string;
  week_start_date: string;
  title: string;
  summary: string;
  status: 'draft' | 'published';
};

function mapPublication(row: PublicationRow) {
  return {
    id: row.id,
    weekStartDate: row.week_start_date,
    title: row.title,
    summary: row.summary,
    status: row.status,
  };
}

type MetricRow = {
  metric_key: string;
  metric_value: string;
  dp_suppressed: boolean;
  lawful_basis: string;
  source_plugin: string;
  is_estimate: boolean;
};

function mapMetric(row: MetricRow) {
  return {
    metricKey: row.metric_key,
    metricValue: Number(row.metric_value),
    dpSuppressed: row.dp_suppressed,
    lawfulBasis: row.lawful_basis,
    sourcePlugin: row.source_plugin,
    isEstimate: row.is_estimate,
  };
}

export async function getLatestPublication() {
  const publicationResult = await queryDb<PublicationRow>(
    `SELECT id::text, week_start_date::text, title, summary, status
     FROM gdp_publications
     WHERE status = 'published'
     ORDER BY updated_at DESC
     LIMIT 1`,
  );

  const publication = publicationResult.rows[0] ? mapPublication(publicationResult.rows[0]) : null;
  if (!publication) {
    return null;
  }

  const metricsResult = await queryDb<MetricRow>(
    `SELECT metric_key, metric_value::text, dp_suppressed, lawful_basis, source_plugin, is_estimate
     FROM gdp_metric_snapshots
     WHERE week_start_date = $1
     ORDER BY metric_key ASC`,
    [publication.weekStartDate],
  );

  return {
    publication,
    metrics: metricsResult.rows.map(mapMetric),
  };
}

export async function upsertPublication(input: {
  actorId: string;
  weekStartDate: string;
  title: string;
  summary: string;
  publish: boolean;
}) {
  const result = await queryDb<PublicationRow>(
    `INSERT INTO gdp_publications
      (id, week_start_date, title, summary, status, created_by_user_id, published_by_user_id, published_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, CASE WHEN $5 = 'published' THEN $6 ELSE NULL END, CASE WHEN $5 = 'published' THEN NOW() ELSE NULL END)
     ON CONFLICT (id)
     DO NOTHING
     RETURNING id::text, week_start_date::text, title, summary, status`,
    [randomUUID(), input.weekStartDate, input.title.trim(), input.summary.trim(), input.publish ? 'published' : 'draft', input.actorId],
  );

  if (result.rows[0]) {
    return mapPublication(result.rows[0]);
  }

  const fallback = await queryDb<PublicationRow>(
    `SELECT id::text, week_start_date::text, title, summary, status
     FROM gdp_publications
     WHERE week_start_date = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [input.weekStartDate],
  );

  if (!fallback.rows[0]) {
    throw new Error('not_found');
  }

  return mapPublication(fallback.rows[0]);
}

export async function getGdpShellStats(): Promise<{ memberCount: number | null; gdpValueUsd: number | null }> {
  const report = await getLatestPublication();
  if (!report) return { memberCount: null, gdpValueUsd: null };
  const memberMetric = report.metrics.find((m) => m.metricKey === 'weekly_active_users');
  const gdpMetric = report.metrics.find((m) => m.metricKey === 'gdp_total_revenue');
  return {
    memberCount: memberMetric ? memberMetric.metricValue : null,
    gdpValueUsd: gdpMetric ? gdpMetric.metricValue : null,
  };
}

export async function insertGdpAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  await queryDb(
    `INSERT INTO gdp_admin_audit_trail
      (id, actor_id, command, policy_status, reason, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [randomUUID(), input.actorId, input.command, input.policyStatus, input.reason, input.targetType, input.targetId, JSON.stringify(input.metadata ?? {})],
  );
}
