import { SYSTEM_FLAGS } from '@ctf/shared';
import { evaluateBooleanFlag } from './server';

// Demo mode routes data-fetching surfaces to synthetic/demo-safe data so no real
// production data is exposed during video/screenshot recordings. Defaults to false
// (real data) — demo mode is an explicit operator action for a recording session.
// The data-routing implementation (demo-tenant seed records) reads this switch; see
// ctf-public-surface-session-continuity.md.
export async function isDemoMode(): Promise<boolean> {
	return evaluateBooleanFlag(SYSTEM_FLAGS.DEMO_MODE, false);
}
