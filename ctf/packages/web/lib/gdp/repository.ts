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

// === Currency USD rate admin (issue #312 P2) ===
// The owner curates a notional USD factor per currency, used ONLY to roll
// multi-currency volume into the single USD-denominated GDP estimate. The most
// recent as_of row per currency is the active factor; older rows are history.
// LEGAL GUARDRAIL: never a per-wallet or per-price "ServiceCredits = fiat" value.

type CurrencyRateHistoryRow = {
  usd_rate: string;
  as_of: string;
  source: string;
};

export type CurrencyRateAdminEntry = {
  code: string;
  label: string;
  symbol: string | null;
  isServiceCredits: boolean;
  decimalPlaces: number;
  sortOrder: number;
  current: { usdRate: number; asOf: string; source: string } | null;
  history: { usdRate: number; asOf: string; source: string }[];
};

type CurrencyMetaRow = {
  code: string;
  label: string;
  symbol: string | null;
  is_service_credits: boolean;
  decimal_places: number;
  sort_order: number;
};

// Build the full rate-admin view: every active currency with its current factor
// (latest as_of) and its prior factors (newest first).
export async function listCurrencyRateAdmin(): Promise<CurrencyRateAdminEntry[]> {
  const currencyResult = await queryDb<CurrencyMetaRow>(
    `SELECT code, label, symbol, is_service_credits, decimal_places, sort_order
     FROM currencies
     WHERE is_active = TRUE
     ORDER BY sort_order ASC, code ASC`,
  );

  const rateResult = await queryDb<CurrencyRateHistoryRow & { currency_code: string }>(
    `SELECT currency_code, usd_rate::text, as_of::text, source
     FROM currency_usd_rates
     ORDER BY currency_code ASC, as_of DESC`,
  );

  const ratesByCurrency = new Map<string, { usdRate: number; asOf: string; source: string }[]>();
  for (const row of rateResult.rows) {
    const list = ratesByCurrency.get(row.currency_code) ?? [];
    list.push({ usdRate: Number(row.usd_rate), asOf: row.as_of, source: row.source });
    ratesByCurrency.set(row.currency_code, list);
  }

  return currencyResult.rows.map((c) => {
    const ordered = ratesByCurrency.get(c.code) ?? [];
    const current = ordered[0] ?? null;
    const history = ordered.slice(1);
    return {
      code: c.code,
      label: c.label,
      symbol: c.symbol,
      isServiceCredits: c.is_service_credits,
      decimalPlaces: c.decimal_places,
      sortOrder: c.sort_order,
      current,
      history,
    };
  });
}

export async function currencyExists(code: string): Promise<boolean> {
  const result = await queryDb<{ code: string }>(
    `SELECT code FROM currencies WHERE code = $1 AND is_active = TRUE LIMIT 1`,
    [code],
  );
  return result.rows.length > 0;
}

// Insert a new dated factor row. Revising the same as_of date updates that row
// (ON CONFLICT (currency_code, as_of) DO UPDATE) instead of failing the UNIQUE
// constraint; any other date adds a new history row and leaves prior rows intact.
export async function upsertCurrencyUsdRate(input: {
  currencyCode: string;
  usdRate: number;
  asOf: string;
  source: string;
}): Promise<{ currencyCode: string; usdRate: number; asOf: string; source: string }> {
  const result = await queryDb<{ currency_code: string; usd_rate: string; as_of: string; source: string }>(
    `INSERT INTO currency_usd_rates (currency_code, usd_rate, as_of, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (currency_code, as_of)
     DO UPDATE SET usd_rate = EXCLUDED.usd_rate, source = EXCLUDED.source
     RETURNING currency_code, usd_rate::text, as_of::text, source`,
    [input.currencyCode, input.usdRate, input.asOf, input.source],
  );

  const row = result.rows[0];
  return { currencyCode: row.currency_code, usdRate: Number(row.usd_rate), asOf: row.as_of, source: row.source };
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
