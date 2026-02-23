/**
 * Integration examples: MDC check before metric-dependent code generation.
 *
 * Each example shows the required guard pattern.  If checkMetricDefined
 * returns a blocking MdcDefinitionRequest the example aborts and surfaces
 * the structured request to the caller — no metric-dependent code runs.
 */

import {
  checkMetricDefined,
  isCanonicalMetric,
  isMdcBlock,
  type CanonicalMetric,
  type MdcDefinitionRequest,
} from './checkMetricDefined.js';

// ---------------------------------------------------------------------------
// Example 1 — Creating an alert rule
// ---------------------------------------------------------------------------

interface AlertRule {
  metricId: string;
  condition: string;
  severity: string;
  message: string;
}

export function createAlertRule(metricIdentifier: string): AlertRule | MdcDefinitionRequest {
  const result = checkMetricDefined(metricIdentifier, 'createAlertRule');
  if (isMdcBlock(result)) {
    // Abort: surface the blocking request to the caller / issue tracker.
    return result;
  }

  const metric: CanonicalMetric = result;
  const firstRule = metric.allowed_thresholds?.alert_rules?.[0];

  // Safe to generate code — metric is fully defined in the canonical registry.
  return {
    metricId: metric.id,
    condition: firstRule?.condition ?? `${metric.id} != null`,
    severity: firstRule?.severity ?? 'warning',
    message: firstRule?.message ?? `Alert fired for metric: ${metric.name}`,
  };
}

// ---------------------------------------------------------------------------
// Example 2 — Writing an ETL transform / Spark job
// ---------------------------------------------------------------------------

interface EtlTransform {
  jobName: string;
  sourceQuery: string;
  outputTable: string;
  schedule: string;
}

export function buildEtlTransform(
  metricIdentifier: string,
  outputTable: string,
  schedule: string,
): EtlTransform | MdcDefinitionRequest {
  const result = checkMetricDefined(metricIdentifier, 'buildEtlTransform');
  if (isMdcBlock(result)) {
    return result;
  }

  const metric: CanonicalMetric = result;

  return {
    jobName: `etl_${metric.id}`,
    sourceQuery: metric.calculation,
    outputTable,
    schedule,
  };
}

// ---------------------------------------------------------------------------
// Example 3 — Adding a column to a metrics schema
// ---------------------------------------------------------------------------

interface SchemaColumn {
  columnName: string;
  columnType: string;
  comment: string;
}

export function addMetricSchemaColumn(
  metricIdentifier: string,
): SchemaColumn | MdcDefinitionRequest {
  const result = checkMetricDefined(metricIdentifier, 'addMetricSchemaColumn');
  if (isMdcBlock(result)) {
    return result;
  }

  const metric: CanonicalMetric = result;

  const typeMap: Record<string, string> = {
    integer: 'BIGINT',
    float: 'DOUBLE PRECISION',
    percent: 'NUMERIC(5,2)',
    currency: 'NUMERIC(18,2)',
    datetime: 'TIMESTAMPTZ',
    string: 'TEXT',
  };

  return {
    columnName: metric.id,
    columnType: typeMap[metric.data_type] ?? 'TEXT',
    comment: `${metric.description} | unit: ${metric.unit} | owner: ${metric.owner}`,
  };
}

// ---------------------------------------------------------------------------
// Example 4 — Generating a dashboard widget / Prometheus exporter metric
// ---------------------------------------------------------------------------

interface DashboardWidget {
  title: string;
  prometheusMetricName: string;
  unit: string;
  description: string;
  helpText: string;
}

export function createDashboardWidget(
  metricIdentifier: string,
): DashboardWidget | MdcDefinitionRequest {
  const result = checkMetricDefined(metricIdentifier, 'createDashboardWidget');
  if (isMdcBlock(result)) {
    return result;
  }

  const metric: CanonicalMetric = result;
  // Prometheus metric names must match [a-zA-Z_:][a-zA-Z0-9_:]*.
  const prometheusName = `ctf_${metric.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  return {
    title: metric.name,
    prometheusMetricName: prometheusName,
    unit: metric.unit,
    description: metric.description,
    helpText: `Canonical metric: ${metric.id} | owner: ${metric.owner} | last updated: ${metric.last_updated}`,
  };
}
