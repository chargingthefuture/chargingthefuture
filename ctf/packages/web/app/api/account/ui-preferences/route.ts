import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { getUserUiPreferences, setUserUiPreferences } from 'lib/account/ui-preferences-repository';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { isThemeName, THEME_NAMES, type ThemeName } from 'lib/theme/theme-tokens';
import { isSeInterfaceVersion, SE_INTERFACE_VERSIONS, type SeInterfaceVersion } from '@ctf/shared';
import { reportError } from 'lib/observability/report';

// Per-user UI preferences: the theme and which interface (3.0 or 3.1) the member sees. Auth posture
// matches the other /api/account routes: any signed-in identity (including unlock-pending) may read
// and set its own.
// The choice is non-sensitive, scoped to the caller's own row, and CSRF-guarded on write.

export const dynamic = 'force-dynamic';

function invalidPayload(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: ACCOUNT_ERROR_CODE.invalidPayload, message }, { status: 400 });
}

type Changes = { theme?: ThemeName; interfaceVersion?: SeInterfaceVersion };

// A body that is not JSON, or a value the app does not have, is refused rather than saved as the
// default: answering 200 to a broken request would overwrite the member's saved choice. Either
// field may be sent alone; at least one must be.
type ReadResult = { ok: true; changes: Changes } | { ok: false; message: string };

async function readFields(request: Request): Promise<{ ok: true; fields: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const body = (await request.json()) as unknown;
    return { ok: true, fields: body && typeof body === 'object' ? (body as Record<string, unknown>) : {} };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unreadable body';
    return { ok: false, message: `The request body is not valid JSON (${reason}).` };
  }
}

// The first reason the fields cannot be saved, or null when they can.
function fieldProblem(fields: Record<string, unknown>): string | null {
  const { theme, interfaceVersion } = fields;
  if (theme === undefined && interfaceVersion === undefined) return 'Send theme, interfaceVersion, or both.';
  if (theme !== undefined && !isThemeName(theme)) return `theme must be one of: ${THEME_NAMES.join(', ')}.`;
  if (interfaceVersion !== undefined && !isSeInterfaceVersion(interfaceVersion)) {
    return `interfaceVersion must be one of: ${SE_INTERFACE_VERSIONS.join(', ')}.`;
  }
  return null;
}

async function readChanges(request: Request): Promise<ReadResult> {
  const read = await readFields(request);
  if (!read.ok) return read;
  const problem = fieldProblem(read.fields);
  if (problem) return { ok: false, message: problem };
  const { theme, interfaceVersion } = read.fields;
  return {
    ok: true,
    changes: {
      theme: isThemeName(theme) ? theme : undefined,
      interfaceVersion: isSeInterfaceVersion(interfaceVersion) ? interfaceVersion : undefined,
    },
  };
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

  const parsed = await readChanges(request);
  if (!parsed.ok) {
    return invalidPayload(parsed.message);
  }

  try {
    const saved = await setUserUiPreferences(access.auth.userId, parsed.changes);
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
