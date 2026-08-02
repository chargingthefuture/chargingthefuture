// Unleash Admin API client for programmatic flag management.
//
// Used when an admin decision (e.g., unlock approval) needs to be reflected in Unleash
// so that the feature-flag client returns the correct value for that user on subsequent
// requests — without a deployment or manual dashboard toggle.
//
// The Unleash Admin API uses the same base URL as the Client API. The token provided
// via UNLEASH_API_TOKEN_BACKEND must have admin permissions in the Unleash instance.
// If only a client-side token was created, flag toggling will return 403 and the caller
// receives a logged warning (non-fatal; DB state remains authoritative as the fallback).

const PROJECT_ID = 'default';
const ENVIRONMENT = process.env.UNLEASH_ENVIRONMENT ?? 'production';
const USER_ID_STRATEGY = 'userWithId';

function getAdminBaseUrl(): string | undefined {
	const base = process.env.UNLEASH_API_URL?.replace(/\/?$/, '');
	if (!base) return undefined;
	// Client API is at /api/; Admin API is at /api/admin/
	return `${base}/admin`;
}

function getAdminToken(): string | undefined {
	return process.env.UNLEASH_API_TOKEN_BACKEND;
}

type UnleashStrategy = {
	id: string;
	name: string;
	parameters: Record<string, string>;
};

async function fetchStrategies(flagKey: string): Promise<UnleashStrategy[]> {
	const base = getAdminBaseUrl();
	const token = getAdminToken();
	if (!base || !token) return [];

	const url = `${base}/projects/${PROJECT_ID}/features/${flagKey}/environments/${ENVIRONMENT}/strategies`;
	const res = await fetch(url, {
		headers: { Authorization: token, 'Content-Type': 'application/json' },
	});
	if (!res.ok) {
		// Surface the failure so a 403 (token lacks admin scope) or 404 (flag missing) is
		// distinguishable from a transient network error; callers still fall back to [].
		const body = await res.text().catch(() => '');
		console.warn(`[unleash-admin] Failed to fetch strategies for ${flagKey}:`, res.status, body);
		return [];
	}
	const data = (await res.json()) as { strategies?: UnleashStrategy[] };
	return data.strategies ?? [];
}

async function createUserIdStrategy(flagKey: string, userId: string): Promise<void> {
	const base = getAdminBaseUrl();
	const token = getAdminToken();
	if (!base || !token) return;

	const url = `${base}/projects/${PROJECT_ID}/features/${flagKey}/environments/${ENVIRONMENT}/strategies`;
	const body = JSON.stringify({ name: USER_ID_STRATEGY, parameters: { userIds: userId } });
	const res = await fetch(url, { method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body });
	if (!res.ok) {
		console.warn(`[unleash-admin] Failed to create strategy for ${flagKey}:`, res.status);
	}
}

async function updateUserIdStrategy(flagKey: string, strategyId: string, currentIds: string, newUserId: string): Promise<void> {
	const base = getAdminBaseUrl();
	const token = getAdminToken();
	if (!base || !token) return;

	const ids = new Set(currentIds.split(',').map((s) => s.trim()).filter(Boolean));
	ids.add(newUserId);
	const merged = Array.from(ids).join(',');

	const url = `${base}/projects/${PROJECT_ID}/features/${flagKey}/environments/${ENVIRONMENT}/strategies/${strategyId}`;
	const body = JSON.stringify({ name: USER_ID_STRATEGY, parameters: { userIds: merged } });
	const res = await fetch(url, { method: 'PUT', headers: { Authorization: token, 'Content-Type': 'application/json' }, body });
	if (!res.ok) {
		console.warn(`[unleash-admin] Failed to update strategy ${strategyId} for ${flagKey}:`, res.status);
	}
}

// Add a userId to the flag's userWithId strategy so Unleash evaluates the flag as ON
// for that specific user. Non-fatal: if the Admin API is unavailable or the token lacks
// admin perms, logs a warning and returns. The DB approval status remains the fallback.
export async function grantUnleashFlagForUser(flagKey: string, userId: string): Promise<void> {
	const base = getAdminBaseUrl();
	const token = getAdminToken();
	if (!base || !token) {
		console.warn('[unleash-admin] Unleash not configured; skipping flag grant for user', userId);
		return;
	}

	try {
		const strategies = await fetchStrategies(flagKey);
		const existing = strategies.find((s) => s.name === USER_ID_STRATEGY);
		if (existing) {
			await updateUserIdStrategy(flagKey, existing.id, existing.parameters.userIds ?? '', userId);
		} else {
			await createUserIdStrategy(flagKey, userId);
		}
	} catch (err) {
		console.warn('[unleash-admin] Error granting flag for user', userId, err);
	}
}
