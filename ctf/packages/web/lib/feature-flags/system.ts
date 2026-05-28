import { SYSTEM_FLAGS } from '@ctf/shared';
import { evaluateBooleanFlag } from './server';
import { getRequestUserId } from 'lib/auth/request-identity';

// Demo participation is a per-user allowlist: the `demo-mode` flag is targeted to
// specific Clerk ids in Unleash, so multiple real users (the owner + opted-in
// testers) can be in demo mode simultaneously while production users are
// unaffected — this is what enables live two-sided demos. See
// ctf-public-surface-session-continuity.md. We evaluate the flag with the caller's
// id as the targeting key; outside a request scope (seed scripts, migrations,
// startup) there is no user, so the flag falls back to its global default (OFF).
// `getRequestUserId` is a lightweight header/cookie read (no token verification or
// DB access) so this is cheap enough to call on the DB-pool-selection hot path.
async function resolveDemoTargetingKey(): Promise<string | undefined> {
	return (await getRequestUserId()) ?? undefined;
}

// Demo mode routes data surfaces to demo-safe data and routes Stream/Formance to
// their non-prod instances so recordings never touch production data or quota.
// Defaults to false (real data) unless the caller is an allowlisted demo participant.
export async function isDemoMode(): Promise<boolean> {
	const targetingKey = await resolveDemoTargetingKey();
	return evaluateBooleanFlag(
		SYSTEM_FLAGS.DEMO_MODE,
		false,
		targetingKey ? { targetingKey } : undefined,
	);
}
