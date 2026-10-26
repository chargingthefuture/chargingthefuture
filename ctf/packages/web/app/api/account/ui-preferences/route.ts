import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { getUserUiPreferences, setUserUiPreferences } from 'lib/account/ui-preferences-repository';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { isThemeName, THEME_NAMES } from 'lib/theme/theme-tokens';
import { isSeInterfaceVersion, SE_INTERFACE_VERSIONS } from '@ctf/shared';
import { reportError } from 'lib/observability/report';

// Per-user UI preferences: the theme and which interface (3.0 or 3.1) the member sees. Auth posture
// matches the other /api/account routes: any signed-in identity (including unlock-pending) may read
// and set its own.
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
    const preferences = await getUserUiPreferences(access.auth.userId);
    return NextResponse.json({ ok: true, ...preferences });
  } catch (error) {
    reportError(error, { area: 'account', op: 'ui_preferences_read' });
    return NextResponse.json(
      {
        ok: false,
        code: ACCOUNT_ERROR_CODE.persistenceUnavailable,
        message: 'Could not read your saved settings: the database read failed.',
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

  // A body that is not JSON, or a value the app does not have, is refused rather than saved as the
  // default: answering 200 to a broken request would overwrite the member's saved choice. Either
  // field may be sent alone; at least one must be.
  let body: { theme?: unknown; interfaceVersion?: unknown } | null;
  try {
    body = (await request.json()) as { theme?: unknown; interfaceVersion?: unknown } | null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unreadable body';
    return invalidPayload(`The request body is not valid JSON (${reason}).`);
  }
  const fields = body && typeof body === 'object' ? body : {};
  if (fields.theme === undefined && fields.interfaceVersion === undefined) {
    return invalidPayload('Send theme, interfaceVersion, or both.');
  }
  if (fields.theme !== undefined && !isThemeName(fields.theme)) {
    return invalidPayload(`theme must be one of: ${THEME_NAMES.join(', ')}.`);
  }
  if (fields.interfaceVersion !== undefined && !isSeInterfaceVersion(fields.interfaceVersion)) {
    return invalidPayload(`interfaceVersion must be one of: ${SE_INTERFACE_VERSIONS.join(', ')}.`);
  }
  const theme = isThemeName(fields.theme) ? fields.theme : undefined;
  const interfaceVersion = isSeInterfaceVersion(fields.interfaceVersion) ? fields.interfaceVersion : undefined;

  try {
    const saved = await setUserUiPreferences(access.auth.userId, { theme, interfaceVersion });
    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    reportError(error, { area: 'account', op: 'ui_preferences_write' });
    return NextResponse.json(
      {
        ok: false,
        code: ACCOUNT_ERROR_CODE.persistenceUnavailable,
        message: 'Could not save your settings: the database write failed.',
      },
      { status: 503 },
    );
  }
}
