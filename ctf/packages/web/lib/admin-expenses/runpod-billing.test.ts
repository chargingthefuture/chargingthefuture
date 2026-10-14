import { describe, expect, it } from 'vitest';
import {
  RUNPOD_BILLING_URL,
  billWindow,
  buildBillingRequestUrl,
  fetchEndpointBill,
  isDaySettled,
  parseBillingResponse,
  runpodEndpointIdFromUrl,
  runpodEndpointIdsFromEnv,
  type FetchLike,
} from './runpod-billing';

const NOW = new Date('2026-10-01T12:00:00Z');
const WINDOW = billWindow(NOW);

function recordingFetch(body: unknown, status = 200): { fetchImpl: FetchLike; urls: string[] } {
  const urls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    urls.push(input);
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
  };
  return { fetchImpl, urls };
}

describe('endpoint ids come from the Ollama settings', () => {
  it('reads the id out of a RunPod serverless address', () => {
    expect(runpodEndpointIdFromUrl('https://api.runpod.ai/v2/abc123xyz')).toBe('abc123xyz');
    expect(runpodEndpointIdFromUrl('https://api.runpod.ai/v2/abc123xyz/run')).toBe('abc123xyz');
  });

  it('finds nothing in a plain Ollama host or an empty setting', () => {
    expect(runpodEndpointIdFromUrl('http://ctf-ollama:11434')).toBeNull();
    expect(runpodEndpointIdFromUrl('')).toBeNull();
    expect(runpodEndpointIdFromUrl(undefined)).toBeNull();
    expect(runpodEndpointIdFromUrl('https://evil.example/v2/abc')).toBeNull();
  });

  it('lists each endpoint once', () => {
    expect(runpodEndpointIdsFromEnv({ OLLAMA_BASE_URL: 'https://api.runpod.ai/v2/abc123xyz' })).toEqual(['abc123xyz']);
    expect(runpodEndpointIdsFromEnv({})).toEqual([]);
  });
});

describe('every billing request names one of this product\'s endpoints', () => {
  it('goes to the REST route with bucketSize=day and an explicit endpointId', async () => {
    const { fetchImpl, urls } = recordingFetch([]);
    const endpointIds = runpodEndpointIdsFromEnv({ OLLAMA_BASE_URL: 'https://api.runpod.ai/v2/abc123xyz' });
    for (const id of endpointIds) await fetchEndpointBill(id, WINDOW, 'test-key', fetchImpl);

    expect(urls.length).toBe(endpointIds.length);
    for (const raw of urls) {
      const url = new URL(raw);
      expect(`${url.origin}${url.pathname}`).toBe(RUNPOD_BILLING_URL);
      // Never the account-wide route, which would include One Percent's spending.
      expect(url.hostname).not.toBe('api.runpod.io');
      expect(url.searchParams.get('bucketSize')).toBe('day');
      expect(url.searchParams.getAll('endpointId')).toHaveLength(1);
      expect(endpointIds).toContain(url.searchParams.get('endpointId'));
    }
  });

  it('refuses to build a request without a usable endpoint id', () => {
    expect(() => buildBillingRequestUrl('', WINDOW)).toThrow();
    expect(() => buildBillingRequestUrl('a&endpointId=other', WINDOW)).toThrow();
  });
});

describe('reading the answer', () => {
  it('fills every day in the window and adds up buckets on the same day', () => {
    const days = parseBillingResponse(
      [
        { amount: 1.25, time: '2026-09-30T00:00:00Z', endpointId: 'abc123xyz', timeBilledMs: 1000 },
        { amount: 0.5, time: '2026-09-30T00:00:00Z', endpointId: 'abc123xyz', timeBilledMs: 500 },
      ],
      'abc123xyz',
      WINDOW,
    );
    expect(days).toHaveLength(31);
    expect(days.find((day) => day.billDate === '2026-09-30')).toEqual({ endpointId: 'abc123xyz', billDate: '2026-09-30', amountUsd: 1.75, timeBilledMs: 1500 });
    expect(days.find((day) => day.billDate === '2026-09-29')?.amountUsd).toBe(0);
  });

  it('refuses an answer that carries another endpoint, so none of it is saved', () => {
    expect(() =>
      parseBillingResponse([{ amount: 9, time: '2026-09-30T00:00:00Z', endpointId: 'one-percent-endpoint' }], 'abc123xyz', WINDOW),
    ).toThrow(/only "abc123xyz" was asked for/);
  });

  it('says what went wrong when RunPod refuses the key', async () => {
    const { fetchImpl } = recordingFetch({ error: 'unauthorized' }, 401);
    await expect(fetchEndpointBill('abc123xyz', WINDOW, 'test-key', fetchImpl)).rejects.toThrow(/401.*refused/);
  });
});

describe('when a day is final', () => {
  it('keeps today and the hours just after midnight open, and settles a day read well after it ended', () => {
    expect(isDaySettled('2026-10-01', NOW)).toBe(false);
    expect(isDaySettled('2026-09-30', new Date('2026-10-01T01:00:00Z'))).toBe(false);
    expect(isDaySettled('2026-09-30', new Date('2026-10-01T06:23:00Z'))).toBe(true);
  });
});
