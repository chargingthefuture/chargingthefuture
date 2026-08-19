'use client';

import { failureText, responseFailureText } from '@/lib/errors/client-failure';
import type {
  CensusEntryRow,
  CensusRunRow,
  CensusRunSummary,
  CensusStanceTally,
  CensusStateCounts,
} from 'lib/quora-live-census/repository';

// Client calls for the census admin screens. Every failure carries whatever the route said rather
// than a house string, so an operator sees which of several things went wrong (rule 137).

export type CensusResult<T> = { ok: true; value: T } | { ok: false; message: string };

const AREA = 'quora-live-census';

async function request<T>(
  url: string,
  init: RequestInit,
  fallback: string,
  op: string,
): Promise<CensusResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1', ...(init.headers ?? {}) },
    });
    if (!response.ok) {
      return { ok: false, message: await responseFailureText(response, fallback) };
    }
    return { ok: true, value: (await response.json()) as T };
  } catch (error) {
    return { ok: false, message: failureText(error, { area: AREA, op, fallback }) };
  }
}

export function fetchRuns(): Promise<CensusResult<{ runs: CensusRunSummary[] }>> {
  return request('/api/quora-live-census/runs', { method: 'GET' }, 'The census runs could not be loaded.', 'list-runs');
}

export function createRun(body: Record<string, unknown>): Promise<CensusResult<{ run: CensusRunRow }>> {
  return request(
    '/api/quora-live-census/runs',
    { method: 'POST', body: JSON.stringify(body) },
    'The run could not be saved.',
    'create-run',
  );
}

export type RunDetail = {
  run: CensusRunRow;
  entries: CensusEntryRow[];
  tally: CensusStanceTally[];
  stateCounts: CensusStateCounts;
};

export function fetchRun(runId: string): Promise<CensusResult<RunDetail>> {
  return request(
    `/api/quora-live-census/runs/${runId}`,
    { method: 'GET' },
    'The census run could not be loaded.',
    'get-run',
  );
}

export function setRunStatus(
  runId: string,
  status: 'open' | 'closed',
): Promise<CensusResult<{ run: CensusRunRow }>> {
  return request(
    `/api/quora-live-census/runs/${runId}`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    'The run status could not be changed.',
    'set-run-status',
  );
}

export function createEntry(
  runId: string,
  body: Record<string, unknown>,
): Promise<CensusResult<{ entry: CensusEntryRow }>> {
  return request(
    `/api/quora-live-census/runs/${runId}/entries`,
    { method: 'POST', body: JSON.stringify(body) },
    'The entry could not be saved.',
    'create-entry',
  );
}

export function deleteEntry(runId: string, entryId: string): Promise<CensusResult<unknown>> {
  return request(
    `/api/quora-live-census/runs/${runId}/entries/${entryId}`,
    { method: 'DELETE' },
    'The entry could not be removed.',
    'delete-entry',
  );
}
