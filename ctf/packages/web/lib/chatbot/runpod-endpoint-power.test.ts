import { describe, expect, it } from 'vitest';
import { readEnginePower, readEnginePowerConfig, setEnginePower, type PowerFetch } from './runpod-endpoint-power';

const CONFIG = { endpointId: 'abc123', apiKey: 'test-key' };

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; method: string; body?: string; auth: string }[] = [];
  const fetchImpl: PowerFetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body, auth: init.headers.Authorization });
    return { ok: status < 400, status, text: async () => JSON.stringify(body) };
  };
  return { fetchImpl, calls };
}

describe('readEnginePowerConfig', () => {
  it('takes the endpoint id from the RunPod address and the key from OLLAMA_API_KEY', () => {
    expect(readEnginePowerConfig({ OLLAMA_BASE_URL: 'https://api.runpod.ai/v2/abc123', OLLAMA_API_KEY: ' k ' }))
      .toEqual({ ok: true, endpointId: 'abc123', apiKey: 'k' });
  });
  it('refuses a plain Ollama host', () => {
    expect(readEnginePowerConfig({ OLLAMA_BASE_URL: 'http://ollama:11434', OLLAMA_API_KEY: 'k' }).ok).toBe(false);
  });
  it('refuses without a key', () => {
    const config = readEnginePowerConfig({ OLLAMA_BASE_URL: 'https://api.runpod.ai/v2/abc123' });
    expect(config.ok).toBe(false);
  });
});

describe('engine power', () => {
  it('reads 0 max workers as off', async () => {
    const { fetchImpl, calls } = fakeFetch(200, { id: 'abc123', workersMax: 0 });
    expect(await readEnginePower(CONFIG, fetchImpl)).toEqual({ endpointId: 'abc123', workersMax: 0, on: false });
    expect(calls[0]).toMatchObject({ url: 'https://rest.runpod.io/v1/endpoints/abc123', method: 'GET', auth: 'Bearer test-key' });
  });

  it('turning on sets 1 max worker on that endpoint only', async () => {
    const { fetchImpl, calls } = fakeFetch(200, { id: 'abc123', workersMax: 1 });
    expect((await setEnginePower(CONFIG, true, fetchImpl)).on).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: 'https://rest.runpod.io/v1/endpoints/abc123', method: 'PATCH' });
    expect(JSON.parse(calls[0].body ?? '')).toEqual({ workersMax: 1 });
  });

  it('turning off sets 0', async () => {
    const { fetchImpl, calls } = fakeFetch(200, { id: 'abc123', workersMax: 0 });
    expect((await setEnginePower(CONFIG, false, fetchImpl)).on).toBe(false);
    expect(JSON.parse(calls[0].body ?? '')).toEqual({ workersMax: 0 });
  });

  it('says so when RunPod did not apply the change', async () => {
    const { fetchImpl } = fakeFetch(200, { id: 'abc123', workersMax: 0 });
    await expect(setEnginePower(CONFIG, true, fetchImpl)).rejects.toThrow(/kept endpoint abc123 at 0/);
  });

  it('names the key when RunPod refuses it', async () => {
    const { fetchImpl } = fakeFetch(403, { error: 'forbidden' });
    await expect(readEnginePower(CONFIG, fetchImpl)).rejects.toThrow(/OLLAMA_API_KEY was refused/);
  });
});
