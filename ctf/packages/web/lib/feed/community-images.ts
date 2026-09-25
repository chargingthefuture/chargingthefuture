import type { PoolClient } from 'pg';
import { queryDb } from 'lib/db/postgres';

// Pictures on Commons posts. Admins only to post (owner decision, 2026-09-25): the owner explains the
// product with screenshots, and the Commons is where those are shown now that Quora erases the accounts
// they were shared from. Public along with the post, so signed-out visitors see them too while public
// viewing is on. One picture per post, stored against the post in feed_community_post_images, so it is
// deleted with the post.

export const COMMUNITY_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type CommunityImageContentType = (typeof COMMUNITY_IMAGE_TYPES)[number];

// The browser scales a picture to at most 1600 pixels on its long side and re-encodes it before
// sending, which lands most screenshots well under a megabyte. The cap leaves room for a PNG from a
// browser that cannot encode WebP, and stops anything larger before it reaches the database.
export const COMMUNITY_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const COMMUNITY_IMAGE_MAX_DIMENSION = 4096;
export const COMMUNITY_IMAGE_MAX_ALT_LENGTH = 500;

export type CommunityPostImageUpload = {
  bytes: Uint8Array;
  contentType: CommunityImageContentType;
  width: number;
  height: number;
  altText: string;
};

// What a timeline read carries about a post's picture. The bytes are served separately, by post id,
// so a page of messages never carries them.
export type FeedCommunityImage = {
  altText: string;
  width: number;
  height: number;
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

// The type is read from the file's first bytes, never from the name or the type the browser claimed,
// so a file that only says it is a picture is refused.
export function sniffCommunityImageType(bytes: Uint8Array): CommunityImageContentType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

// Width and height come from the browser that drew the scaled copy. They are used only to reserve the
// picture's space before it loads, so a message list does not jump; a wrong value distorts nothing.
export function parseCommunityImageDimension(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > COMMUNITY_IMAGE_MAX_DIMENSION) return null;
  return parsed;
}

// Called inside createFeedCommunityPost's transaction, so a post and its picture are written together
// or not at all. A post without a picture passes nothing and this does nothing.
export async function insertCommunityPostImage(
  client: PoolClient,
  postId: string,
  image: CommunityPostImageUpload | null | undefined,
): Promise<void> {
  if (!image) return;
  await client.query(
    `
      INSERT INTO feed_community_post_images (post_id, content_type, bytes, byte_size, width, height, alt_text)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
    `,
    [postId, image.contentType, Buffer.from(image.bytes), image.bytes.byteLength, image.width, image.height, image.altText],
  );
}

// The pictures on one timeline page, keyed by post id. Metadata only.
export async function loadCommunityPostImages(
  client: PoolClient,
  postIds: string[],
): Promise<Map<string, FeedCommunityImage>> {
  const images = new Map<string, FeedCommunityImage>();
  if (postIds.length === 0) return images;
  const result = await client.query<{ post_id: string; alt_text: string; width: number; height: number }>(
    'SELECT post_id, alt_text, width, height FROM feed_community_post_images WHERE post_id = ANY($1::uuid[])',
    [postIds],
  );
  for (const row of result.rows) {
    images.set(row.post_id, { altText: row.alt_text, width: row.width, height: row.height });
  }
  return images;
}

// The picture itself, for the image route. Only a post that is still up is served: a post taken down
// by moderation keeps its row until it is deleted, and its picture must not stay reachable by address.
// A signed-out read (`publicOnly`) additionally needs the post to be one the public Commons lists:
// its timeline item active, published, not expired, and addressed to the general audience.
export async function readCommunityPostImage(
  postId: string,
  { publicOnly }: { publicOnly: boolean },
): Promise<{ contentType: CommunityImageContentType; bytes: Buffer } | null> {
  const result = await queryDb<{ content_type: CommunityImageContentType; bytes: Buffer }>(
    `
      SELECT i.content_type, i.bytes
      FROM feed_community_post_images i
      JOIN feed_community_posts p ON p.id = i.post_id
      WHERE i.post_id = $1::uuid
        AND p.moderation_status = 'accepted'
        AND (
          NOT $2::boolean
          OR EXISTS (
            SELECT 1
            FROM feed_items f
            JOIN feed_item_targets t ON t.item_id = f.id
            WHERE f.source_community_post_id = p.id
              AND f.item_type = 'community'
              AND f.is_active = TRUE
              AND f.published_at <= NOW()
              AND (f.expires_at IS NULL OR f.expires_at > NOW())
              AND t.target_role IN ('member', 'admin', 'all')
          )
        )
      LIMIT 1
    `,
    [postId, publicOnly],
  );
  const row = result.rows[0];
  return row ? { contentType: row.content_type, bytes: row.bytes } : null;
}
