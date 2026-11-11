import { queryDb } from 'lib/db/postgres';
import { normalizeTheme, type ThemeName } from 'lib/theme/theme-tokens';
import {
  SE_DEFAULT_INTERFACE_VERSION,
  isSeInterfaceVersion,
  isSeTextSize,
  isSeThemeColor,
  isSeThemeMode,
  type SeInterfaceVersion,
  type SeReadingPrefs,
  type SeTextSize,
  type SeThemeChoice,
  type SeThemeColor,
  type SeThemeMode,
} from '@ctf/shared';

// Per-user UI preferences: the 3.0 theme, which interface (3.0 or 3.1) the member sees, and the 3.1
// Settings: colors (null until picked), text size, higher contrast, easier-to-read font and emoji
// rain. Backed by the user_ui_preferences table. Reads return the defaults when no row exists;
// writes upsert on user_id and change only the fields given.

export type UserUiPreferences = {
  theme: ThemeName;
  interfaceVersion: SeInterfaceVersion;
  seTheme: SeThemeChoice | null;
  reading: SeReadingPrefs;
};

export type UiPreferenceChanges = {
  theme?: ThemeName;
  interfaceVersion?: SeInterfaceVersion;
  seThemeColor?: SeThemeColor;
  seThemeMode?: SeThemeMode;
  textSize?: SeTextSize;
  highContrast?: boolean;
  readableFont?: boolean;
  emojiRain?: boolean;
};

type PreferencesRow = {
  theme: string;
  interface_version: string;
  se_theme_color?: string | null;
  se_theme_mode?: string | null;
  text_size?: string | null;
  high_contrast?: boolean | null;
  readable_font?: boolean | null;
  emoji_rain?: boolean | null;
};

const COLUMNS = 'theme, interface_version, se_theme_color, se_theme_mode, text_size, high_contrast, readable_font, emoji_rain';

function mapSeTheme(row: PreferencesRow | undefined): SeThemeChoice | null {
  const color = row?.se_theme_color;
  const mode = row?.se_theme_mode;
  return isSeThemeColor(color) && isSeThemeMode(mode) ? { color, mode } : null;
}

function mapReading(row: PreferencesRow | undefined): SeReadingPrefs {
  return {
    textSize: isSeTextSize(row?.text_size) ? row.text_size : 'default',
    highContrast: row?.high_contrast === true,
    readableFont: row?.readable_font === true,
    emojiRain: row?.emoji_rain === true,
  };
}

function mapRow(row: PreferencesRow | undefined): UserUiPreferences {
  return {
    theme: normalizeTheme(row?.theme),
    interfaceVersion: isSeInterfaceVersion(row?.interface_version) ? row.interface_version : SE_DEFAULT_INTERFACE_VERSION,
    seTheme: mapSeTheme(row),
    reading: mapReading(row),
  };
}

export async function getUserUiPreferences(userId: string): Promise<UserUiPreferences> {
  const result = await queryDb<PreferencesRow>(`SELECT ${COLUMNS} FROM user_ui_preferences WHERE user_id = $1 LIMIT 1`, [userId]);
  return mapRow(result.rows[0]);
}

export async function getUserInterfaceVersion(userId: string): Promise<SeInterfaceVersion> {
  return (await getUserUiPreferences(userId)).interfaceVersion;
}

export async function setUserUiPreferences(userId: string, changes: UiPreferenceChanges): Promise<UserUiPreferences> {
  const result = await queryDb<PreferencesRow>(
    `INSERT INTO user_ui_preferences (user_id, theme, interface_version, se_theme_color, se_theme_mode, text_size,
       high_contrast, readable_font, emoji_rain, updated_at)
     VALUES ($1, COALESCE($2, 'default'), COALESCE($3, '${SE_DEFAULT_INTERFACE_VERSION}'), $4, $5, COALESCE($6, 'default'),
       COALESCE($7, FALSE), COALESCE($8, FALSE), COALESCE($9, FALSE), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       theme = COALESCE($2, user_ui_preferences.theme),
       interface_version = COALESCE($3, user_ui_preferences.interface_version),
       se_theme_color = COALESCE($4, user_ui_preferences.se_theme_color),
       se_theme_mode = COALESCE($5, user_ui_preferences.se_theme_mode),
       text_size = COALESCE($6, user_ui_preferences.text_size),
       high_contrast = COALESCE($7, user_ui_preferences.high_contrast),
       readable_font = COALESCE($8, user_ui_preferences.readable_font),
       emoji_rain = COALESCE($9, user_ui_preferences.emoji_rain),
       updated_at = NOW()
     RETURNING ${COLUMNS}`,
    [
      userId,
      changes.theme ?? null,
      changes.interfaceVersion ?? null,
      changes.seThemeColor ?? null,
      changes.seThemeMode ?? null,
      changes.textSize ?? null,
      changes.highContrast ?? null,
      changes.readableFont ?? null,
      changes.emojiRain ?? null,
    ],
  );
  return mapRow(result.rows[0]);
}
