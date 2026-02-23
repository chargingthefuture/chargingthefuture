import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetricDataType = 'integer' | 'float' | 'percent' | 'currency' | 'datetime' | 'string';

export interface MetricInput {
  name: string;
  type: string;
}

export interface AlertRule {
  condition: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface AllowedThresholds {
  min?: number;
  max?: number;
  alert_rules?: AlertRule[];
}

export interface CanonicalMetric {
  id: string;
  name: string;
  description: string;
  owner: string;
  data_type: MetricDataType;
  unit: string;
  calculation: string;
  inputs: MetricInput[];
  example_values: Array<{ input: Record<string, unknown>; output: unknown }>;
  last_updated: string;
  allowed_thresholds?: AllowedThresholds;
}

export interface CanonicalMetricsFile {
  canonical_metrics: CanonicalMetric[];
}

export type MdcResultStatus = 'found' | 'not_found' | 'ambiguous';

export interface MdcLogEntry {
  timestamp: string;
  caller: string;
  metric_identifier: string;
  result: MdcResultStatus;
  canonical_id?: string;
}

export interface MdcDefinitionRequest {
  status: 'not_found' | 'ambiguous';
  metric_identifier: string;
  blocking_message: string;
  definition_questions: string[];
  canonical_metrics_location: string;
  template_url: string;
}

export type MdcCheckResult = CanonicalMetric | MdcDefinitionRequest;

// ---------------------------------------------------------------------------
// Registry loader
// ---------------------------------------------------------------------------

const REGISTRY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'canonical_metrics.yaml',
);

let _cachedRegistry: CanonicalMetric[] | null = null;

function loadRegistry(): CanonicalMetric[] {
  if (_cachedRegistry !== null) return _cachedRegistry;
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  // Minimal YAML list parser — avoids adding a production dependency for a
  // config-only file. Delegates to a hand-rolled parser sufficient for the
  // canonical_metrics schema.
  _cachedRegistry = parseCanonicalMetricsYaml(raw);
  return _cachedRegistry;
}

// Simple YAML-to-object parser for the canonical_metrics.yaml structure.
// Handles the two-level indented list used in canonical_metrics.yaml.
function parseCanonicalMetricsYaml(yaml: string): CanonicalMetric[] {
  // Split into top-level "- " metric blocks under the `canonical_metrics:` key.
  const lines = yaml.split('\n');
  const metrics: CanonicalMetric[] = [];
  let inMetrics = false;
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (line.trimStart().startsWith('canonical_metrics:')) {
      inMetrics = true;
      continue;
    }
    if (!inMetrics) continue;

    if (/^  - id:/.test(line)) {
      if (currentBlock.length > 0) {
        const m = parseMetricBlock(currentBlock);
        if (m) metrics.push(m);
      }
      currentBlock = [line];
    } else if (inMetrics && line.startsWith('  ')) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    const m = parseMetricBlock(currentBlock);
    if (m) metrics.push(m);
  }
  return metrics;
}

/** Returns true if `line` is a 4-space-indented YAML key that is a sibling of
 *  the `inputs:` block (i.e., it signals the end of the inputs list). */
function isNonInputSiblingKey(line: string): boolean {
  return (
    /^\s{4}\w/.test(line) &&
    !/^\s+- /.test(line) &&
    !/^\s+name:/.test(line) &&
    !/^\s+type:/.test(line)
  );
}

function parseMetricBlock(lines: string[]): CanonicalMetric | null {
  const get = (key: string): string => {
    // Allow for optional list-item prefix ("- ") before the key name.
    const re = new RegExp(`^\\s+(?:-\\s+)?${key}:\\s*"?([^"\\n]+)"?`);
    for (const l of lines) {
      const m = l.match(re);
      if (m) return m[1].trim().replace(/^"(.*)"$/, '$1');
    }
    return '';
  };

  const id = get('id');
  if (!id) return null;

  // Parse inputs as an array of { name, type } objects from the nested list
  const inputs: MetricInput[] = [];
  let inInputs = false;
  for (const line of lines) {
    if (/^\s+inputs:/.test(line)) { inInputs = true; continue; }
    if (inInputs && /^\s+- name:/.test(line)) {
      const nameMatch = line.match(/name:\s*"?([^"\n]+)"?/);
      inputs.push({ name: nameMatch ? nameMatch[1].trim() : '', type: '' });
    }
    if (inInputs && /^\s+type:/.test(line) && inputs.length > 0) {
      const typeMatch = line.match(/type:\s*"?([^"\n]+)"?/);
      inputs[inputs.length - 1].type = typeMatch ? typeMatch[1].trim() : '';
    }
    // Stop when we reach a non-input sibling key at the same indent level.
    // A sibling key is a 4-space-indented word that is not a list item ("- ")
    // and is not the "name:" or "type:" fields that belong to the inputs list.
    if (inInputs && isNonInputSiblingKey(line)) {
      inInputs = false;
    }
  }

  return {
    id,
    name: get('name'),
    description: get('description'),
    owner: get('owner'),
    data_type: get('data_type') as MetricDataType,
    unit: get('unit'),
    calculation: get('calculation'),
    inputs,
    example_values: [],
    last_updated: get('last_updated'),
  };
}

// ---------------------------------------------------------------------------
// Structured audit logger
// ---------------------------------------------------------------------------

export function logMdcCheck(entry: MdcLogEntry): void {
  // Emit a single-line JSON log so that log aggregators (e.g., Datadog,
  // CloudWatch) can parse structured fields without additional parsing.
  console.log(JSON.stringify(entry));
}

// ---------------------------------------------------------------------------
// MDC enforcement function
// ---------------------------------------------------------------------------

const REGISTRY_LOCATION = 'platform/server/mdc/canonical_metrics.yaml';
const TEMPLATE_URL =
  'https://github.com/chargingthefuture/chargingthefuture/blob/main/platform/server/mdc/README.md#adding-a-new-metric';

const DEFINITION_QUESTIONS: string[] = [
  'a. Confirm the exact metric name and any aliases or synonyms that refer to the same measurement.',
  'b. Provide a precise human-readable description: what is being measured, over what population, and in what context?',
  'c. Specify data_type (integer | float | percent | currency | datetime) and unit (e.g., users, USD, kWh, ms).',
  'd. Provide calculation logic as SQL, a formula, or pseudocode, and list every required input field with its type.',
  'e. Provide at least two concrete example inputs and their expected output values.',
  'f. Specify the metric owner (name + email) and acceptable alert thresholds (min, max, alert rules with conditions and severity).',
  'g. Indicate the expected update cadence (real-time, hourly, daily, monthly) and data retention period.',
];

/**
 * Checks whether `metric_identifier` exists in the canonical metric registry.
 *
 * - If exactly one match is found, returns the full `CanonicalMetric` entry.
 * - If no match or multiple ambiguous matches are found, returns a blocking
 *   `MdcDefinitionRequest` and does NOT generate any code.
 *
 * @param metric_identifier - The metric ID or name to look up.
 * @param caller - Human-readable label for the call site (used in audit log).
 */
export function checkMetricDefined(
  metric_identifier: string,
  caller: string = 'unknown',
): MdcCheckResult {
  const registry = loadRegistry();
  const normalised = metric_identifier.trim().toLowerCase();

  const matches = registry.filter(
    (m) =>
      m.id.toLowerCase() === normalised ||
      m.name.toLowerCase() === normalised,
  );

  const timestamp = new Date().toISOString();

  if (matches.length === 1) {
    const entry = matches[0];
    logMdcCheck({ timestamp, caller, metric_identifier, result: 'found', canonical_id: entry.id });
    return entry;
  }

  const status: MdcResultStatus = matches.length === 0 ? 'not_found' : 'ambiguous';
  logMdcCheck({ timestamp, caller, metric_identifier, result: status });

  const blocking_message =
    matches.length === 0
      ? `MDC BLOCK: Metric "${metric_identifier}" was not found in the canonical registry at ${REGISTRY_LOCATION}. ` +
        `Code generation has been aborted. Please define the metric using the template before proceeding.`
      : `MDC BLOCK: "${metric_identifier}" matched ${matches.length} entries in the canonical registry ` +
        `(${matches.map((m) => m.id).join(', ')}). Ambiguity must be resolved before code generation can proceed.`;

  return {
    status,
    metric_identifier,
    blocking_message,
    definition_questions: DEFINITION_QUESTIONS,
    canonical_metrics_location: REGISTRY_LOCATION,
    template_url: TEMPLATE_URL,
  };
}

/**
 * Type guard: returns `true` if the result is a found `CanonicalMetric`.
 */
export function isCanonicalMetric(result: MdcCheckResult): result is CanonicalMetric {
  return 'id' in result && 'calculation' in result;
}

/**
 * Type guard: returns `true` if the result is a blocking `MdcDefinitionRequest`.
 */
export function isMdcBlock(result: MdcCheckResult): result is MdcDefinitionRequest {
  return 'blocking_message' in result;
}
