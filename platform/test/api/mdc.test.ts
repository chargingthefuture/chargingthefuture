import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkMetricDefined,
  isCanonicalMetric,
  isMdcBlock,
} from '../../server/mdc/checkMetricDefined.js';

/**
 * Tests for the Metric Definition and Confirmation (MDC) enforcement module.
 */

describe('MDC - checkMetricDefined', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('found metric by id', () => {
    it('returns the canonical entry when looking up by exact id', () => {
      const result = checkMetricDefined('active_users_daily', 'test-suite');
      expect(isCanonicalMetric(result)).toBe(true);
      if (isCanonicalMetric(result)) {
        expect(result.id).toBe('active_users_daily');
        expect(result.name).toBe('Daily Active Users');
        expect(result.data_type).toBe('integer');
        expect(result.unit).toBe('users');
        expect(result.owner).toBe('platform-metrics@chargingthefuture.io');
        expect(result.calculation).toBeTruthy();
        expect(result.inputs.length).toBeGreaterThan(0);
        expect(result.last_updated).toBeTruthy();
      }
    });

    it('returns the canonical entry when looking up the second registered metric', () => {
      const result = checkMetricDefined('charge_session_revenue_usd', 'test-suite');
      expect(isCanonicalMetric(result)).toBe(true);
      if (isCanonicalMetric(result)) {
        expect(result.id).toBe('charge_session_revenue_usd');
        expect(result.data_type).toBe('currency');
        expect(result.unit).toBe('USD');
      }
    });

    it('is case-insensitive for metric identifiers', () => {
      const result = checkMetricDefined('ACTIVE_USERS_DAILY', 'test-suite');
      expect(isCanonicalMetric(result)).toBe(true);
    });
  });

  describe('not_found metric', () => {
    it('returns a blocking MdcDefinitionRequest for an unknown identifier', () => {
      const result = checkMetricDefined('non_existent_metric_xyz', 'test-suite');
      expect(isMdcBlock(result)).toBe(true);
      if (isMdcBlock(result)) {
        expect(result.status).toBe('not_found');
        expect(result.metric_identifier).toBe('non_existent_metric_xyz');
        expect(result.blocking_message).toContain('MDC BLOCK');
        expect(result.definition_questions.length).toBe(7);
        expect(result.canonical_metrics_location).toBeTruthy();
        expect(result.template_url).toBeTruthy();
      }
    });

    it('blocking message references the metric identifier', () => {
      const result = checkMetricDefined('made_up_kpi', 'test-suite');
      expect(isMdcBlock(result)).toBe(true);
      if (isMdcBlock(result)) {
        expect(result.blocking_message).toContain('made_up_kpi');
      }
    });

    it('includes all 7 required definition questions', () => {
      const result = checkMetricDefined('undefined_metric', 'test-suite');
      if (isMdcBlock(result)) {
        expect(result.definition_questions).toHaveLength(7);
        // Each question should start with a letter label (a. through g.)
        result.definition_questions.forEach((q, i) => {
          const label = String.fromCharCode(97 + i);
          expect(q).toMatch(new RegExp(`^${label}\\.`));
        });
      }
    });
  });

  describe('audit logging', () => {
    it('emits a structured JSON log on a successful lookup', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      checkMetricDefined('active_users_daily', 'logging-test');
      expect(spy).toHaveBeenCalledOnce();
      const logged = JSON.parse(spy.mock.calls[0][0] as string);
      expect(logged.result).toBe('found');
      expect(logged.canonical_id).toBe('active_users_daily');
      expect(logged.caller).toBe('logging-test');
      expect(logged.metric_identifier).toBe('active_users_daily');
      expect(logged.timestamp).toBeTruthy();
    });

    it('emits a structured JSON log with result=not_found for unknown metrics', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      checkMetricDefined('phantom_metric', 'logging-test');
      expect(spy).toHaveBeenCalledOnce();
      const logged = JSON.parse(spy.mock.calls[0][0] as string);
      expect(logged.result).toBe('not_found');
      expect(logged.canonical_id).toBeUndefined();
    });
  });

  describe('type guards', () => {
    it('isCanonicalMetric returns true only for found entries', () => {
      const found = checkMetricDefined('active_users_daily', 'test-suite');
      const notFound = checkMetricDefined('ghost_metric', 'test-suite');
      expect(isCanonicalMetric(found)).toBe(true);
      expect(isCanonicalMetric(notFound)).toBe(false);
    });

    it('isMdcBlock returns true only for blocking responses', () => {
      const found = checkMetricDefined('active_users_daily', 'test-suite');
      const notFound = checkMetricDefined('ghost_metric', 'test-suite');
      expect(isMdcBlock(found)).toBe(false);
      expect(isMdcBlock(notFound)).toBe(true);
    });
  });
});
