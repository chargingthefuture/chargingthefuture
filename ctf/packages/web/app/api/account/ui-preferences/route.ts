import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { getUserTheme, setUserTheme } from 'lib/account/ui-preferences-repository';
import { normalizeTheme } from 'lib/theme/theme-tokens';

// Per-user UI theme preference. Auth posture matches the other /api/account routes:
// any signed-in identity (including unlock-pending) may read and set its own theme.
// The choice is non-sensitive, scoped to the caller's own row, and CSRF-guarded on write.

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireAccountAccess();
  if (!access.allowed) {
    return access.response;
  }

  const theme = await getUserTheme(access.auth.userId);
  return NextResponse.json({ ok: true, theme });
}

export async function PUT(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) {
    return csrf;
  }

  const access = await requireAccountAccess();
  if (!access.allowed) {
    return access.response;
  }

  const body = (await request.json().catch(() => ({}))) as { theme?: unknown };
  const theme = normalizeTheme(body.theme);
  await setUserTheme(access.auth.userId, theme);
  return NextResponse.json({ ok: true, theme });
}
