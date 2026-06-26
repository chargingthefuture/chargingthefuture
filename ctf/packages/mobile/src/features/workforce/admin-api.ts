import { authedFetch } from '../../auth/authedFetch';

// Admin client for the Workforce plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/workforce/admin/* (plus the read-only dashboard
// endpoint). Admin access is enforced server-side; a 401/403 surfaces as a
// "forbidden" notice in the screen.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
const API_ROOT = '/api/workforce';

export type WorkforceConfig = {
  exportsEnabled: boolean;
  reportWeekTimezone: string;
  reportWeekStartDow: number;
};

export type WorkforceDashboard = {
  workforceTotal: number;
  recruitedTotal: number;
  occupationsTotal: number;
};

export type WorkforceOverviewResult = {
  ok: boolean;
  forbidden: boolean;
  config: WorkforceConfig | null;
  dashboard: WorkforceDashboard | null;
  message: string | null;
};

function jsonHeaders(withCsrf = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (withCsrf) headers['x-ctf-csrf'] = '1';
  return headers;
}

// GET admin config and the read-only dashboard counts in one pass.
export async function fetchAdminOverview(): Promise<WorkforceOverviewResult> {
  const [configRes, dashboardRes] = await Promise.all([
    authedFetch(`${API_ROOT}/admin/config`, { headers: jsonHeaders() }),
    authedFetch(`${API_ROOT}/dashboard`, { headers: jsonHeaders() }),
  ]);

  // Either endpoint returning 401/403 means the viewer is not an admin (or the token expired between the
  // two parallel calls). Check the dashboard the same way as the config — otherwise a config that loads
  // while the dashboard is forbidden would silently render the admin panel with a missing snapshot.
  if (
    configRes.status === 401 || configRes.status === 403 ||
    dashboardRes.status === 401 || dashboardRes.status === 403
  ) {
    return { ok: false, forbidden: true, config: null, dashboard: null, message: 'Admin access is required.' };
  }
  if (!configRes.ok) {
    return {
      ok: false,
      forbidden: false,
      config: null,
      dashboard: null,
      message: `Could not load config (${configRes.status}).`,
    };
  }

  const configData = (await configRes.json()) as { config?: WorkforceConfig };
  const dashboardData = dashboardRes.ok
    ? ((await dashboardRes.json()) as { dashboard?: WorkforceDashboard })
    : { dashboard: undefined };

  return {
    ok: true,
    forbidden: false,
    config: configData.config ?? null,
    dashboard: dashboardData.dashboard ?? null,
    // A non-auth dashboard failure (e.g. 500) still loads the config, but say so instead of showing a
    // silently-empty snapshot.
    message: dashboardRes.ok ? null : `Could not load the dashboard snapshot (${dashboardRes.status}).`,
  };
}

// PUT updated config. Carries the CSRF confirmation header the API requires.
export async function updateAdminConfig(config: WorkforceConfig): Promise<WorkforceConfig> {
  const res = await authedFetch(`${API_ROOT}/admin/config`, {
    method: 'PUT',
    headers: jsonHeaders(true),
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    throw new Error(`config_update_failed:${res.status}`);
  }
  const data = (await res.json()) as { config: WorkforceConfig };
  return data.config;
}

// POST run the incremental recruited sync. CSRF-confirmed mutation.
export async function runAdminSync(): Promise<void> {
  const res = await authedFetch(`${API_ROOT}/admin/sync`, {
    method: 'POST',
    headers: jsonHeaders(true),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`sync_failed:${res.status}`);
  }
}

// POST enqueue a recruited-total recompute. CSRF-confirmed mutation.
export async function runAdminRecompute(): Promise<void> {
  const res = await authedFetch(`${API_ROOT}/admin/recompute`, {
    method: 'POST',
    headers: jsonHeaders(true),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`recompute_failed:${res.status}`);
  }
}
