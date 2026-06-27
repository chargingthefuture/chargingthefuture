import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { countActiveUsersLastDays, countTotalMembers } from 'lib/engagement/login-activity';
import { recognizeCommunityValueIndex } from 'lib/gdp/recognition';

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
  // One publication per week: key the upsert on week_start_date (a UNIQUE index), so re-saving a week
  // updates its existing row instead of inserting a duplicate. The previous ON CONFLICT (id) clause could
  // never fire — a fresh randomUUID() is generated on every call — so each save silently created a new
  // row, and the now-removed fallback SELECT then returned whichever week row was most recently updated.
  const result = await queryDb<PublicationRow>(
    `INSERT INTO gdp_publications
      (id, week_start_date, title, summary, status, created_by_user_id, published_by_user_id, published_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, CASE WHEN $5 = 'published' THEN $6 ELSE NULL END, CASE WHEN $5 = 'published' THEN NOW() ELSE NULL END)
     ON CONFLICT (week_start_date)
     DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       status = EXCLUDED.status,
       published_by_user_id = CASE WHEN EXCLUDED.status = 'published' THEN EXCLUDED.published_by_user_id ELSE gdp_publications.published_by_user_id END,
       published_at = CASE WHEN EXCLUDED.status = 'published' THEN NOW() ELSE gdp_publications.published_at END,
       updated_at = NOW()
     RETURNING id::text, week_start_date::text, title, summary, status`,
    [randomUUID(), input.weekStartDate, input.title.trim(), input.summary.trim(), input.publish ? 'published' : 'draft', input.actorId],
  );

  if (!result.rows[0]) {
    throw new Error('not_found');
  }

  return mapPublication(result.rows[0]);
}

export async function getGdpShellStats(): Promise<{ memberCount: number | null; gdpValueUsd: number | null }> {
  // Member count is the total number of people signed up (every account), read directly from the
  // identity table — independent of whether a weekly GDP report has been published. The GDP value
  // still comes from the latest published report. The two are fetched together but kept separate so
  // a missing report never blanks the member count, and a member-count read error never blanks GDP.
  const [memberCount, report] = await Promise.all([
    countTotalMembers().catch(() => null),
    getLatestPublication().catch(() => null),
  ]);
  const gdpMetric = report?.metrics.find((m) => m.metricKey === 'gdp_total_revenue') ?? null;
  return {
    memberCount,
    gdpValueUsd: gdpMetric ? gdpMetric.metricValue : null,
  };
}

// === Live report (issue: GDP dashboard activity) ===
// The dashboard reads a LIVE report computed on each request — no weekly publish/snapshot step. The
// headline is the Community Value Index recomputed from every registered recognition source right now;
// member counts come straight from the activity tables. A published narrative (title/summary), if the
// owner writes one, is overlaid; otherwise a standing "live" narrative is synthesized so the surface
// always has a heading. This read NEVER writes a snapshot — gdp_metric_snapshots / the weekly
// recognize job remain only for optional history, not for what the dashboard shows.

/** A live metric row, shaped exactly like the published-snapshot rows the web shell and Android read. */
export type GdpLiveMetricRow = {
  metricKey: string;
  metricValue: number;
  dpSuppressed: boolean;
  lawfulBasis: string;
  sourcePlugin: string;
  isEstimate: boolean;
};

/** One registered recognition source's contribution to the live Community Value Index. */
export type GdpLiveSource = { pluginSlug: string; label: string; valueIndex: number };

export type GdpLiveReport = {
  publication: { id: string; weekStartDate: string; title: string; summary: string; status: 'draft' | 'published' };
  metrics: GdpLiveMetricRow[];
  sources: GdpLiveSource[];
};

const LIVE_PUBLICATION_TITLE = 'TI Skills Economy — Live';
const LIVE_PUBLICATION_SUMMARY =
  'Live measure of every recognized non-incentive exchange across the community, recomputed on each visit — no weekly publish step. Incentives (rewards, bonuses, thank-you grants) and plain transfers are not counted.';

// Monday (UTC) of the current week, matching the week-start convention used by scripts/recognizeGdp.mjs,
// so the synthesized live narrative is dated to the same week the recognition pipeline would record.
function currentWeekStartIso(now = new Date()): string {
  const day = now.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const backToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + backToMonday));
  return monday.toISOString().slice(0, 10);
}

// Newest published narrative (title/summary only) — used to overlay the owner's optional report on top
// of the live numbers. One query; the snapshot metrics are intentionally not read (the numbers are live).
async function getLatestPublicationNarrative() {
  const result = await queryDb<PublicationRow>(
    `SELECT id::text, week_start_date::text, title, summary, status
     FROM gdp_publications
     WHERE status = 'published'
     ORDER BY updated_at DESC
     LIMIT 1`,
  );
  return result.rows[0] ? mapPublication(result.rows[0]) : null;
}

export async function buildLiveGdpReport(): Promise<GdpLiveReport> {
  const [breakdown, totalMembers, activeMembers, narrative] = await Promise.all([
    recognizeCommunityValueIndex(),
    countTotalMembers().catch(() => null),
    countActiveUsersLastDays(7).catch(() => null),
    getLatestPublicationNarrative().catch(() => null),
  ]);

  // Community Value Index is the headline: a normalized, weighted estimate (no currency symbol), so it
  // carries is_estimate = true exactly like the weekly pipeline writes it.
  const metrics: GdpLiveMetricRow[] = [
    {
      metricKey: 'gdp_value_index',
      metricValue: Math.round(breakdown.valueIndex),
      dpSuppressed: false,
      lawfulBasis: 'service-delivery',
      sourcePlugin: 'gdp',
      isEstimate: true,
    },
  ];
  if (activeMembers !== null) {
    metrics.push({
      metricKey: 'weekly_active_users',
      metricValue: activeMembers,
      dpSuppressed: false,
      lawfulBasis: 'engagement',
      sourcePlugin: 'gdp',
      isEstimate: false,
    });
  }
  if (totalMembers !== null) {
    metrics.push({
      metricKey: 'total_members',
      metricValue: totalMembers,
      dpSuppressed: false,
      lawfulBasis: 'engagement',
      sourcePlugin: 'gdp',
      isEstimate: false,
    });
  }

  const publication =
    narrative ?? {
      id: 'live',
      weekStartDate: currentWeekStartIso(),
      title: LIVE_PUBLICATION_TITLE,
      summary: LIVE_PUBLICATION_SUMMARY,
      status: 'published' as const,
    };

  return { publication, metrics, sources: breakdown.perSource };
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
