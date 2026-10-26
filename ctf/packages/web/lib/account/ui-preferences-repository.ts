import { queryDb } from 'lib/db/postgres';
import { normalizeTheme, type ThemeName } from 'lib/theme/theme-tokens';
import { isSeInterfaceVersion, SE_DEFAULT_INTERFACE_VERSION, type SeInterfaceVersion } from '@ctf/shared';

// Per-user UI preferences: the theme choice and which interface (3.0 or 3.1) the member sees.
// Backed by the user_ui_preferences table. Reads return the defaults when no row exists; writes
// upsert on user_id and change only the fields given.

export type UserUiPreferences = { theme: ThemeName; interfaceVersion: SeInterfaceVersion };

type PreferencesRow = { theme: string; interface_version: string };

export async function getUserUiPreferences(userId: string): Promise<UserUiPreferences> {
  const result = await queryDb<PreferencesRow>(
    `SELECT theme, interface_version FROM user_ui_preferences WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    theme: normalizeTheme(row?.theme),
    interfaceVersion: isSeInterfaceVersion(row?.interface_version) ? row.interface_version : SE_DEFAULT_INTERFACE_VERSION,
  };
}

export async function getUserInterfaceVersion(userId: string): Promise<SeInterfaceVersion> {
  return (await getUserUiPreferences(userId)).interfaceVersion;
}

export async function setUserUiPreferences(
  userId: string,
  changes: { theme?: ThemeName; interfaceVersion?: SeInterfaceVersion },
): Promise<UserUiPreferences> {
  const result = await queryDb<PreferencesRow>(
    `INSERT INTO user_ui_preferences (user_id, theme, interface_version, updated_at)
     VALUES ($1, COALESCE($2, 'default'), COALESCE($3, '${SE_DEFAULT_INTERFACE_VERSION}'), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       theme = COALESCE($2, user_ui_preferences.theme),
       interface_version = COALESCE($3, user_ui_preferences.interface_version),
       updated_at = NOW()
     RETURNING theme, interface_version`,
    [userId, changes.theme ?? null, changes.interfaceVersion ?? null],
  );
  const row = result.rows[0];
  return {
    theme: normalizeTheme(row?.theme),
    interfaceVersion: isSeInterfaceVersion(row?.interface_version) ? row.interface_version : SE_DEFAULT_INTERFACE_VERSION,
  };
}
