// Account & Data API client — binds to the same live backend the web surface uses.
// GET    /api/account/services           → AccountServicesResponse (read-only registry projection)
// DELETE /api/account/services/:slug      → per-service deletion
// DELETE /api/account/full-account        → full-account deletion
//
// Mutations send the same-origin CSRF header (`x-ctf-csrf: 1`) and JSON content type that the
// account routes require. All calls go through authedFetch so the Clerk bearer token is
// attached and the base URL comes from runtime config (APP_URL).

import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { authedFetch } from '../../auth/authedFetch';

// Bound every request so a stalled connection can't trap the screen in a loading or
// submitting state forever. Aborts after the timeout and reports a clear "network_timeout".
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await authedFetch(path, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('network_timeout');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type AccountService = {
  slug: string;
  name: string;
  summary: string;
  serviceScopeSupported: boolean;
  // Whether the JSON export has anything to read for this service. Absent on older payloads,
  // treated as false.
  exportable?: boolean;
};

export type AccountServicesResponse = {
  ok: boolean;
  deletable: AccountService[];
  retained: AccountService[];
  counts: { deletable: number; retained: number; total: number };
};

export async function fetchAccountServices(): Promise<AccountServicesResponse> {
  const res = await fetchWithTimeout('/api/account/services');
  if (!res.ok) {
    throw new Error(`account_services_fetch_failed:${res.status}`);
  }
  return res.json() as Promise<AccountServicesResponse>;
}

// The server said no. Carries the route's own message, or the web's default when it gave none, so
// the screen can tell a refusal apart from a network failure as the web does.
export class AccountRequestError extends Error {}

async function readMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  return body.message ?? fallback;
}

export async function deleteServiceData(slug: string): Promise<void> {
  const res = await fetchWithTimeout(`/api/account/services/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
  });
  if (!res.ok) {
    throw new AccountRequestError(await readMessage(res, 'Unable to delete this data. Please try again.'));
  }
}

export async function deleteFullAccount(): Promise<void> {
  const res = await fetchWithTimeout('/api/account/full-account', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
  });
  if (!res.ok) {
    throw new AccountRequestError(await readMessage(res, 'Unable to complete full-account deletion. Please try again.'));
  }
}

// Download a JSON export, as the web's download buttons do: GET the export route, then hand the file
// to the member. A phone has no downloads bar, so the file is written to the app's cache and offered
// through the system share sheet, where the member saves it to Files or Drive or sends it on.
//   GET /api/account/services/:slug/export   one service
//   GET /api/account/full-account/export     every service
export async function exportAccountData(path: string, filename: string): Promise<void> {
  const res = await fetchWithTimeout(path);
  if (!res.ok) {
    throw new AccountRequestError(await readMessage(res, 'Unable to export this data. Please try again.'));
  }
  const text = await res.text();
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: filename });
}
