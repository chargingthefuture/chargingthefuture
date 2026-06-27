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

export type ListLibraryItemsInput = {
  userId?: string | null;
  sort?: string | null;
  favoritesOnly?: boolean;
  limit?: number | null;
  offset?: number | null;
};

const LIBRARY_SORT_CLAUSES: Record<string, string> = {
  newest: 'i.updated_at DESC',
  oldest: 'i.updated_at ASC',
  title: 'i.title ASC',
};

export async function listLibraryItems(input: ListLibraryItemsInput = {}) {
  const orderBy = (input.sort && LIBRARY_SORT_CLAUSES[input.sort]) ?? LIBRARY_SORT_CLAUSES.newest;

  const limit = Number.isInteger(input.limit) && (input.limit as number) > 0
    ? Math.min(input.limit as number, 100)
    : 100;
  const offset = Number.isInteger(input.offset) && (input.offset as number) > 0
    ? (input.offset as number)
    : 0;

  const favoritesOnly = Boolean(input.favoritesOnly) && Boolean(input.userId);

  const filters = ['i.is_active = TRUE'];
  const params: unknown[] = [];
  if (favoritesOnly) {
    params.push(input.userId);
    filters.push(
      `EXISTS (SELECT 1 FROM gentle_pulse_favorites f WHERE f.item_id = i.id AND f.user_id = $${params.length})`,
    );
  }
  const whereClause = filters.join(' AND ');

  const totalResult = await queryDb<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM gentle_pulse_library_items i
     WHERE ${whereClause}`,
    params,
  );
  const total = Number(totalResult.rows[0]?.total ?? '0');

  const pageParams = [...params, limit, offset];
  const result = await queryDb<LibraryItemRow>(
    `SELECT i.id::text, i.slug, i.title, i.description, i.media_url, i.support_route
     FROM gentle_pulse_library_items i
     WHERE ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );

  return { items: result.rows.map(mapLibraryItem), total };
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

  const result = await queryDb<{ play_count: string; media_url: string }>(
    `SELECT COUNT(e.id)::text AS play_count, i.media_url
     FROM gentle_pulse_library_items i
     LEFT JOIN gentle_pulse_play_events e ON e.item_id = i.id
     WHERE i.id = $1
     GROUP BY i.media_url`,
    [input.itemId],
  );

  const row = result.rows[0];
  return {
    playCount: Number(row?.play_count ?? '0'),
    mediaUrl: row?.media_url ?? '',
  };
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

  const result = await queryDb<{ rating_count: string; average_rating: string | null }>(
    `SELECT COUNT(*)::text AS rating_count, AVG(rating)::text AS average_rating
     FROM gentle_pulse_ratings
     WHERE item_id = $1`,
    [input.itemId],
  );

  const row = result.rows[0];
  return {
    ratingCount: Number(row?.rating_count ?? '0'),
    averageRating: row?.average_rating ? Number(Number(row.average_rating).toFixed(2)) : 0,
  };
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
