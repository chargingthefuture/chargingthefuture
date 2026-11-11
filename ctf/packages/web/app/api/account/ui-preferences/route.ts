import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { getUserUiPreferences, setUserUiPreferences, type UiPreferenceChanges } from 'lib/account/ui-preferences-repository';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { isThemeName, THEME_NAMES } from 'lib/theme/theme-tokens';
import {
  isSeInterfaceVersion,
  isSeTextSize,
  isSeThemeColor,
  isSeThemeMode,
  SE_INTERFACE_VERSIONS,
  SE_TEXT_SIZES,
  SE_THEME_COLORS,
  type SeThemeChoice,
} from '@ctf/shared';
import { reportError } from 'lib/observability/report';

// Per-user UI preferences: the 3.0 theme, which interface (3.0 or 3.1) the member sees, and the 3.1
// Settings (colors, text size, higher contrast, easier-to-read font, emoji rain). Auth posture
// matches the other /api/account routes: any signed-in identity (including unlock-pending) may read
// and set its own.
// The choice is non-sensitive, scoped to the caller's own row, and CSRF-guarded on write.

export const dynamic = 'force-dynamic';

function invalidPayload(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: ACCOUNT_ERROR_CODE.invalidPayload, message }, { status: 400 });
}

// A body that is not JSON, or a value the app does not have, is refused rather than saved as the
// default: answering 200 to a broken request would overwrite the member's saved choice. Any field
// may be sent alone; at least one must be. seTheme is `{ color, mode }`, both together.
type ReadResult = { ok: true; changes: UiPreferenceChanges } | { ok: false; message: string };

async function readFields(request: Request): Promise<{ ok: true; fields: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const body = (await request.json()) as unknown;
    return { ok: true, fields: body && typeof body === 'object' ? (body as Record<string, unknown>) : {} };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unreadable body';
    return { ok: false, message: `The request body is not valid JSON (${reason}).` };
  }
}

const isBool = (value: unknown): value is boolean => typeof value === 'boolean';

// Each field the route takes, the check it must pass, and what the refusal says.
const FIELDS: ReadonlyArray<{ name: string; valid: (_value: unknown) => boolean; message: string }> = [
  { name: 'theme', valid: isThemeName, message: `theme must be one of: ${THEME_NAMES.join(', ')}.` },
  { name: 'interfaceVersion', valid: isSeInterfaceVersion, message: `interfaceVersion must be one of: ${SE_INTERFACE_VERSIONS.join(', ')}.` },
  {
    name: 'seTheme',
    valid: (value) => {
      const pick = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      return isSeThemeColor(pick.color) && isSeThemeMode(pick.mode);
    },
    message: `seTheme must be { color, mode } with color one of ${SE_THEME_COLORS.join(', ')} and mode dark or light.`,
  },
  { name: 'textSize', valid: isSeTextSize, message: `textSize must be one of: ${SE_TEXT_SIZES.join(', ')}.` },
  { name: 'highContrast', valid: isBool, message: 'highContrast must be true or false.' },
  { name: 'readableFont', valid: isBool, message: 'readableFont must be true or false.' },
  { name: 'emojiRain', valid: isBool, message: 'emojiRain must be true or false.' },
];

// The first reason the fields cannot be saved, or null when they can.
function fieldProblem(fields: Record<string, unknown>): string | null {
  const sent = FIELDS.filter((field) => fields[field.name] !== undefined);
  if (sent.length === 0) return `Send at least one of: ${FIELDS.map((field) => field.name).join(', ')}.`;
  return sent.find((field) => !field.valid(fields[field.name]))?.message ?? null;
}

function toChanges(fields: Record<string, unknown>): UiPreferenceChanges {
  const pick = (fields.seTheme ?? {}) as Partial<SeThemeChoice>;
  return {
    theme: isThemeName(fields.theme) ? fields.theme : undefined,
    interfaceVersion: isSeInterfaceVersion(fields.interfaceVersion) ? fields.interfaceVersion : undefined,
    seThemeColor: pick.color,
    seThemeMode: pick.mode,
    textSize: isSeTextSize(fields.textSize) ? fields.textSize : undefined,
    highContrast: isBool(fields.highContrast) ? fields.highContrast : undefined,
    readableFont: isBool(fields.readableFont) ? fields.readableFont : undefined,
    emojiRain: isBool(fields.emojiRain) ? fields.emojiRain : undefined,
  };
}

async function readChanges(request: Request): Promise<ReadResult> {
  const read = await readFields(request);
  if (!read.ok) return read;
  const problem = fieldProblem(read.fields);
  if (problem) return { ok: false, message: problem };
  return { ok: true, changes: toChanges(read.fields) };
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
