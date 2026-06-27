import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';

type LibraryItemRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  media_url: string;
  support_route: string;
};

function mapLibraryItem(row: LibraryItemRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    mediaUrl: row.media_url,
    supportRoute: row.support_route,
  };
}

export async function listLibraryItems() {
  const result = await queryDb<LibraryItemRow>(
    `SELECT id::text, slug, title, description, media_url, support_route
     FROM gentle_pulse_library_items
     WHERE is_active = TRUE
     ORDER BY updated_at DESC`,
  );

  return result.rows.map(mapLibraryItem);
}

export async function getLibraryItemById(itemId: string) {
  const result = await queryDb<LibraryItemRow>(
    `SELECT id::text, slug, title, description, media_url, support_route
     FROM gentle_pulse_library_items
     WHERE id = $1 AND is_active = TRUE
     LIMIT 1`,
    [itemId],
  );

  return result.rows[0] ? mapLibraryItem(result.rows[0]) : null;
}

export async function trackPlayEvent(input: { userId: string | null; anonymousClientId: string | null; itemId: string; completed: boolean }) {
  await queryDb(
    `INSERT INTO gentle_pulse_play_events (id, user_id, anonymous_client_id, item_id, completed)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), input.userId, input.anonymousClientId, input.itemId, input.completed],
  );
}

export async function upsertRating(input: { userId: string; itemId: string; rating: number }) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('invalid_payload');
  }

  await queryDb(
    `INSERT INTO gentle_pulse_ratings (id, user_id, item_id, rating)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, item_id)
     DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()`,
    [randomUUID(), input.userId, input.itemId, input.rating],
  );
}

export async function setFavorite(input: { userId: string; itemId: string; favorited: boolean }) {
  if (input.favorited) {
    await queryDb(
      `INSERT INTO gentle_pulse_favorites (id, user_id, item_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_id) DO NOTHING`,
      [randomUUID(), input.userId, input.itemId],
    );
    return;
  }

  await queryDb(
    `DELETE FROM gentle_pulse_favorites
     WHERE user_id = $1 AND item_id = $2`,
    [input.userId, input.itemId],
  );
}
