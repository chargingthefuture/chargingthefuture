// Account & Data API client — binds to the same live backend the web surface uses.
// GET    /api/account/services           → AccountServicesResponse (read-only registry projection)
// DELETE /api/account/services/:slug      → per-service deletion
// DELETE /api/account/full-account        → whole-account deletion
//
// Mutations send the same-origin CSRF header (`x-ctf-csrf: 1`) and JSON content type that the
// account routes require.

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

export type AccountService = {
  slug: string;
  name: string;
  summary: string;
  serviceScopeSupported: boolean;
};

export type AccountServicesResponse = {
  ok: boolean;
  deletable: AccountService[];
  retained: AccountService[];
  counts: { deletable: number; retained: number; total: number };
};

export async function fetchAccountServices(): Promise<AccountServicesResponse> {
  const res = await fetch(`${API_BASE}/api/account/services`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`account_services_fetch_failed:${res.status}`);
  }
  return res.json() as Promise<AccountServicesResponse>;
}

export async function deleteServiceData(slug: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/account/services/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new Error(body.message ?? body.code ?? `service_delete_failed:${res.status}`);
  }
}

export async function deleteFullAccount(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/account/full-account`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new Error(body.message ?? body.code ?? `full_account_delete_failed:${res.status}`);
  }
}
