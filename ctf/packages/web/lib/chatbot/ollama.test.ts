import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The endpoint is read from the environment when the module loads, so it is set first and the module
// is imported fresh in each test.
const BASE = 'https://api.runpod.ai/v2/test-endpoint';

type Call = { url: string; method: string };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function loadModule() {
  vi.resetModules();
  vi.stubEnv('OLLAMA_BASE_URL', BASE);
  return import('./ollama');
}

describe('callOllamaChat on RunPod', () => {
  let calls: Call[];

  beforeEach(() => {
    calls = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('cancels the job when a status request fails before it finishes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.endsWith('/run')) return jsonResponse({ id: 'job-1', status: 'IN_QUEUE' });
      if (url.includes('/status/')) return jsonResponse({}, 502);
      return jsonResponse({});
    }));
    const { callOllamaChat } = await loadModule();

    await expect(callOllamaChat([{ role: 'user', content: 'hi' }])).rejects.toThrow('ollama_http_error:502');
    expect(calls.at(-1)).toEqual({ url: `${BASE}/cancel/job-1`, method: 'POST' });
  });

  it('cancels the job on timeout without waiting out the poll interval', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.endsWith('/run')) return jsonResponse({ id: 'job-2', status: 'IN_QUEUE' });
      return jsonResponse({});
    }));
    const { callOllamaChat } = await loadModule();

    const started = Date.now();
    await expect(callOllamaChat([{ role: 'user', content: 'hi' }], { timeoutMs: 50 })).rejects.toMatchObject({
      name: 'AbortError',
    });
    // The poll interval is 1.5s; an abort-aware wait returns well before it.
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(calls.some((c) => c.url.includes('/status/'))).toBe(false);
    expect(calls.at(-1)).toEqual({ url: `${BASE}/cancel/job-2`, method: 'POST' });
  });

  it('does not cancel a job that completed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.endsWith('/run')) return jsonResponse({ id: 'job-3', status: 'COMPLETED', output: { content: 'hello' } });
      return jsonResponse({});
    }));
    const { callOllamaChat } = await loadModule();

    await expect(callOllamaChat([{ role: 'user', content: 'hi' }])).resolves.toMatchObject({ content: 'hello' });
    expect(calls.some((c) => c.url.includes('/cancel/'))).toBe(false);
  });
});
