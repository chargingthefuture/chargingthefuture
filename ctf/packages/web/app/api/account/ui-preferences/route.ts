import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { getUserTheme, setUserTheme } from 'lib/account/ui-preferences-repository';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { isThemeName, THEME_NAMES } from 'lib/theme/theme-tokens';
import { reportError } from 'lib/observability/report';

// Per-user UI theme preference. Auth posture matches the other /api/account routes:
// any signed-in identity (including unlock-pending) may read and set its own theme.
// The choice is non-sensitive, scoped to the caller's own row, and CSRF-guarded on write.

export const dynamic = 'force-dynamic';

function invalidPayload(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: ACCOUNT_ERROR_CODE.invalidPayload, message }, { status: 400 });
}

export async function GET() {
  const access = await requireAccountAccess();
  if (!access.allowed) {
    return access.response;
  }

  try {
    const theme = await getUserTheme(access.auth.userId);
    return NextResponse.json({ ok: true, theme });
  } catch (error) {
    reportError(error, { area: 'account', op: 'ui_preferences_read' });
    return NextResponse.json(
      {
        ok: false,
        code: ACCOUNT_ERROR_CODE.persistenceUnavailable,
        message: 'Could not read your saved theme: the database read failed.',
      },
      { status: 503 },
    );
  }
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

  // A body that is not JSON, or a theme the app does not have, is refused rather than saved as the
  // default theme: answering 200 to a broken request would overwrite the member's saved choice.
  let body: { theme?: unknown } | null;
  try {
    body = (await request.json()) as { theme?: unknown } | null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unreadable body';
    return invalidPayload(`The request body is not valid JSON (${reason}).`);
  }
  const theme = body && typeof body === 'object' ? body.theme : undefined;
  if (!isThemeName(theme)) {
    return invalidPayload(`theme must be one of: ${THEME_NAMES.join(', ')}.`);
  }

  try {
    await setUserTheme(access.auth.userId, theme);
    return NextResponse.json({ ok: true, theme });
  } catch (error) {
    reportError(error, { area: 'account', op: 'ui_preferences_write' });
    return NextResponse.json(
      {
        ok: false,
        code: ACCOUNT_ERROR_CODE.persistenceUnavailable,
        message: 'Could not save your theme: the database write failed.',
      },
      { status: 503 },
    );
  }
}
