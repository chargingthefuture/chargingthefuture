// Turning this product's drafting endpoint on or off. RunPod sets an endpoint to 0 max workers after
// about two weeks with no requests, and every draft then times out until somebody raises it again.
// "On" is 1 max worker and "Off" is 0. Only the endpoint named in OLLAMA_BASE_URL is ever read or
// changed: the RunPod account is shared with One Percent, and its endpoints are never touched here.
// The fetch is passed in so each request can be checked in a test without a network.

import { runpodEndpointIdFromUrl } from 'lib/admin-expenses/runpod-billing';

export const RUNPOD_ENDPOINTS_URL = 'https://rest.runpod.io/v1/endpoints';
export const ENGINE_ON_WORKERS = 1;
const REQUEST_TIMEOUT_MS = 20_000;

export type EnginePowerConfig =
  | { ok: true; endpointId: string; apiKey: string }
  | { ok: false; reason: string };

export function readEnginePowerConfig(env: Record<string, string | undefined> = process.env): EnginePowerConfig {
  const endpointId = runpodEndpointIdFromUrl(env.OLLAMA_BASE_URL);
  if (!endpointId) {
    return { ok: false, reason: 'OLLAMA_BASE_URL is not a RunPod serverless address, so there is no endpoint to turn on or off.' };
  }
  const apiKey = (env.OLLAMA_API_KEY ?? '').trim();
  if (!apiKey) {
    return { ok: false, reason: 'OLLAMA_API_KEY is not set, so RunPod cannot be asked to change the endpoint.' };
  }
  return { ok: true, endpointId, apiKey };
}

export type EnginePower = { endpointId: string; workersMax: number; on: boolean };

export type PowerFetch = (input: string, init: {
  method: 'GET' | 'PATCH';
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

async function callRunpod(config: { endpointId: string; apiKey: string }, init: { method: 'GET' | 'PATCH'; body?: string }, fetchImpl: PowerFetch): Promise<EnginePower> {
  const response = await fetchImpl(`${RUNPOD_ENDPOINTS_URL}/${encodeURIComponent(config.endpointId)}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    const hint = response.status === 401 || response.status === 403
      ? ' The key in OLLAMA_API_KEY was refused; it needs read and write access to endpoints in RunPod.'
      : '';
    throw new Error(`RunPod answered ${response.status} to ${init.method} for endpoint ${config.endpointId}.${hint}${text ? ` ${text.slice(0, 200)}` : ''}`);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`RunPod answered endpoint ${config.endpointId} with something that is not JSON.`);
  }
  const workersMax = (body as { workersMax?: unknown } | null)?.workersMax;
  if (typeof workersMax !== 'number' || !Number.isFinite(workersMax)) {
    throw new Error(`RunPod did not say how many max workers endpoint ${config.endpointId} has.`);
  }
  return { endpointId: config.endpointId, workersMax, on: workersMax > 0 };
}

export function readEnginePower(config: { endpointId: string; apiKey: string }, fetchImpl: PowerFetch): Promise<EnginePower> {
  return callRunpod(config, { method: 'GET' }, fetchImpl);
}

export async function setEnginePower(config: { endpointId: string; apiKey: string }, on: boolean, fetchImpl: PowerFetch): Promise<EnginePower> {
  const wanted = on ? ENGINE_ON_WORKERS : 0;
  const result = await callRunpod(config, { method: 'PATCH', body: JSON.stringify({ workersMax: wanted }) }, fetchImpl);
  if (result.workersMax !== wanted) {
    throw new Error(`RunPod kept endpoint ${config.endpointId} at ${result.workersMax} max workers instead of ${wanted}.`);
  }
  return result;
}
