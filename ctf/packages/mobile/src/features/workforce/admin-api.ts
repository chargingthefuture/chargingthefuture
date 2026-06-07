import { Platform } from 'react-native';

// Admin client for the Workforce plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/workforce/admin/* (plus the read-only dashboard
// endpoint). Admin access is enforced server-side; a 401/403 surfaces as a
// "forbidden" notice in the screen.
const API_ROOT =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/workforce' : 'http://localhost:3000/api/workforce';

export type WorkforceConfig = {
  exportsEnabled: boolean;
  killSwitchEnabled: boolean;
  reportWeekTimezone: string;
  reportWeekStartDow: number;
};

export type WorkforceDashboard = {
  workforceTotal: number;
  recruitedTotal: number;
  occupationsTotal: number;
  activeAnnouncementsTotal: number;
};

export type WorkforceOverviewResult = {
  ok: boolean;
  forbidden: boolean;
  config: WorkforceConfig | null;
  dashboard: WorkforceDashboard | null;
  message: string | null;
};

function authHeaders(authToken: string, withCsrf = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
  if (withCsrf) headers['x-ctf-csrf'] = '1';
  return headers;
}

// GET admin config and the read-only dashboard counts in one pass.
export async function fetchAdminOverview(authToken: string): Promise<WorkforceOverviewResult> {
  const [configRes, dashboardRes] = await Promise.all([
    fetch(`${API_ROOT}/admin/config`, { headers: authHeaders(authToken) }),
    fetch(`${API_ROOT}/dashboard`, { headers: authHeaders(authToken) }),
  ]);

  if (configRes.status === 401 || configRes.status === 403) {
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
    message: null,
  };
}

// PUT updated config. Carries the CSRF confirmation header the API requires.
export async function updateAdminConfig(authToken: string, config: WorkforceConfig): Promise<WorkforceConfig> {
  const res = await fetch(`${API_ROOT}/admin/config`, {
    method: 'PUT',
    headers: authHeaders(authToken, true),
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    throw new Error(`config_update_failed:${res.status}`);
  }
  const data = (await res.json()) as { config: WorkforceConfig };
  return data.config;
}

// POST run the incremental recruited sync. CSRF-confirmed mutation.
export async function runAdminSync(authToken: string): Promise<void> {
  const res = await fetch(`${API_ROOT}/admin/sync`, {
    method: 'POST',
    headers: authHeaders(authToken, true),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`sync_failed:${res.status}`);
  }
}

// POST enqueue a recruited-total recompute. CSRF-confirmed mutation.
export async function runAdminRecompute(authToken: string): Promise<void> {
  const res = await fetch(`${API_ROOT}/admin/recompute`, {
    method: 'POST',
    headers: authHeaders(authToken, true),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`recompute_failed:${res.status}`);
  }
}
