import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import type { CommunityImageContentType } from 'lib/feed/community-images';
import type { SocketRelayRequestImage } from './types';

// One picture per SocketRelay request (owner decision, 2026-10-02): SocketRelay is a classifieds board,
// and a listing for a chair or a bike is read faster with a photo of it. Stored against the request in
// socket_relay_request_images and deleted with it. The content type is checked from the file's own
// first bytes by the route, using the same check the Commons pictures use.
//
// An inappropriate picture is an automatic ban with no exceptions. The form shows that warning and
// asks the member to tick it before the file picker opens, and the route refuses an upload without the
// tick, so rules_acknowledged_at is on every stored picture.

export const SOCKET_RELAY_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const SOCKET_RELAY_IMAGE_MAX_ALT_LENGTH = 300;

export type SocketRelayImageUpload = {
  bytes: Uint8Array;
  contentType: CommunityImageContentType;
  width: number;
  height: number;
  altText: string;
};

type ImageMetaRow = { request_id: string; width: number; height: number; alt_text: string; created_at: Date | string };

export function socketRelayImageUrl(requestId: string, createdAt: Date | string): string {
  // The upload time is in the address so a replaced picture is fetched again instead of read from cache.
  const version = new Date(createdAt).getTime();
  return `/api/socket-relay/requests/${encodeURIComponent(requestId)}/image?v=${version}`;
}

const IMAGE_META_SQL = `
  SELECT request_id::text AS request_id, width, height, alt_text, created_at
  FROM socket_relay_request_images
  WHERE request_id = ANY($1::uuid[])
`;

export function mapImageRows(rows: ImageMetaRow[]): Map<string, SocketRelayRequestImage> {
  const byRequest = new Map<string, SocketRelayRequestImage>();
  for (const row of rows) {
    byRequest.set(row.request_id, {
      url: socketRelayImageUrl(row.request_id, row.created_at),
      alt: row.alt_text,
      width: row.width,
      height: row.height,
    });
  }
  return byRequest;
}

// The pictures for a page of requests, keyed by request id. Metadata only; the bytes are served by id.
export async function loadRequestImages(requestIds: string[], client?: PoolClient): Promise<Map<string, SocketRelayRequestImage>> {
  if (requestIds.length === 0) return new Map();
  const result = client
    ? await client.query<ImageMetaRow>(IMAGE_META_SQL, [requestIds])
    : await queryDb<ImageMetaRow>(IMAGE_META_SQL, [requestIds]);
  return mapImageRows(result.rows);
}

// Owner or admin only. Replaces an earlier picture on the same request.
export async function saveRequestImage(
  requestId: string,
  actorUserId: string,
  isAdmin: boolean,
  image: SocketRelayImageUpload,
): Promise<SocketRelayRequestImage> {
  return withDbTransaction(async (client) => {
    const owner = await client.query<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM socket_relay_requests WHERE id = $1::uuid FOR UPDATE`,
      [requestId],
    );
    if ((owner.rowCount ?? 0) === 0) throw new Error('request_not_found');
    if (!isAdmin && owner.rows[0].owner_user_id !== actorUserId) throw new Error('not_owner');

    const saved = await client.query<ImageMetaRow>(
      `INSERT INTO socket_relay_request_images
         (request_id, uploaded_by_user_id, content_type, bytes, byte_size, width, height, alt_text, rules_acknowledged_at, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (request_id) DO UPDATE SET
         uploaded_by_user_id = EXCLUDED.uploaded_by_user_id, content_type = EXCLUDED.content_type,
         bytes = EXCLUDED.bytes, byte_size = EXCLUDED.byte_size, width = EXCLUDED.width,
         height = EXCLUDED.height, alt_text = EXCLUDED.alt_text,
         rules_acknowledged_at = EXCLUDED.rules_acknowledged_at, created_at = EXCLUDED.created_at
       RETURNING request_id::text AS request_id, width, height, alt_text, created_at`,
      [requestId, actorUserId, image.contentType, Buffer.from(image.bytes), image.bytes.byteLength, image.width, image.height, image.altText],
    );
    await client.query(`UPDATE socket_relay_requests SET updated_at = NOW() WHERE id = $1::uuid`, [requestId]);
    return mapImageRows(saved.rows).get(requestId) as SocketRelayRequestImage;
  });
}

// Owner or admin only. Returns who uploaded the removed picture, so an admin removal can name them.
export async function deleteRequestImage(requestId: string, actorUserId: string, isAdmin: boolean): Promise<{ uploadedByUserId: string } | null> {
  return withDbTransaction(async (client) => {
    const owner = await client.query<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM socket_relay_requests WHERE id = $1::uuid FOR UPDATE`,
      [requestId],
    );
    if ((owner.rowCount ?? 0) === 0) throw new Error('request_not_found');
    if (!isAdmin && owner.rows[0].owner_user_id !== actorUserId) throw new Error('not_owner');

    const removed = await client.query<{ uploaded_by_user_id: string }>(
      `DELETE FROM socket_relay_request_images WHERE request_id = $1::uuid RETURNING uploaded_by_user_id`,
      [requestId],
    );
    if ((removed.rowCount ?? 0) === 0) return null;
    return { uploadedByUserId: removed.rows[0].uploaded_by_user_id };
  });
}

// The bytes, for the image route. Any signed-in member past the read gate may see a request, so they
// may see its picture; the block filter applies to the board list, as it does for the request itself.
export async function readRequestImage(requestId: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  const result = await queryDb<{ content_type: string; bytes: Buffer }>(
    `SELECT content_type, bytes FROM socket_relay_request_images WHERE request_id = $1::uuid LIMIT 1`,
    [requestId],
  );
  return result.rows[0] ? { contentType: result.rows[0].content_type, bytes: result.rows[0].bytes } : null;
}
