import { NextResponse } from 'next/server';
import { SYSTEM_FLAGS } from '@ctf/shared';
import { evaluateBooleanFlag } from './server';

// Public surfaces (non-authenticated screens + public APIs) are reachable when this
// flag is ON. Defaults to true so existing production behavior and local/CI are
// preserved when Unleash is unconfigured; operators turn it OFF to take public
// surfaces offline (e.g. demo lockdown, maintenance) without a redeploy.
export async function isPublicSurfaceEnabled(): Promise<boolean> {
	return evaluateBooleanFlag(SYSTEM_FLAGS.PUBLIC_SURFACE, true);
}

// Demo mode routes data-fetching surfaces to synthetic/demo-safe data so no real
// production data is exposed during video/screenshot recordings. Defaults to false
// (real data) — demo mode is an explicit operator action for a recording session.
// NOTE: this flag is the switch; the data-routing implementation (synthetic source vs
// Neon branch vs demo tenant) is gated on an owner decision — see
// ctf-public-surface-session-continuity.md.
export async function isDemoMode(): Promise<boolean> {
	return evaluateBooleanFlag(SYSTEM_FLAGS.DEMO_MODE, false);
}

// Gate for public (non-authenticated) API routes. Returns a 403 response when the
// public-surface flag is OFF, or null to let the route proceed. Server-only; no
// rendered surface, so it is not design-pass gated.
export async function publicSurfaceGate(): Promise<NextResponse | null> {
	if (await isPublicSurfaceEnabled()) {
		return null;
	}
	return NextResponse.json(
		{ ok: false, code: 'public_surface_disabled', message: 'This surface is currently unavailable.' },
		{ status: 403 },
	);
}
