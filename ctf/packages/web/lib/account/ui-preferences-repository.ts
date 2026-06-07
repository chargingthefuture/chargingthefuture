import { queryDb } from 'lib/db/postgres';
import { normalizeTheme, type ThemeName } from 'lib/theme/theme-tokens';

// Per-user UI preferences (currently just the theme choice). Backed by the
// user_ui_preferences table. Reads return the normalized theme ('default' when no
// row exists); writes upsert on user_id.

type ThemeRow = { theme: string };

export async function getUserTheme(userId: string): Promise<ThemeName> {
  const result = await queryDb<ThemeRow>(
    `SELECT theme FROM user_ui_preferences WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return normalizeTheme(result.rows[0]?.theme);
}

export async function setUserTheme(userId: string, theme: ThemeName): Promise<void> {
  await queryDb<ThemeRow>(
    `INSERT INTO user_ui_preferences (user_id, theme, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, updated_at = NOW()`,
    [userId, theme],
  );
}
