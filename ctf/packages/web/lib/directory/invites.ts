import type { PoolClient } from 'pg';
import { queryDb } from 'lib/db/postgres';
import { getAppUrl } from 'lib/auth/provider-env';
import type { CommunityImageContentType } from 'lib/feed/community-images';
import { INVITE_CODE_RE, normalizeInviteHandle, quoraHandleFromUrl, type DirectoryInviteInput } from './invite-input';
import { stripPictureMetadata } from 'lib/images/strip-metadata';

// Invitations to people listed in the Directory (owner decision, 2026-10-15).
//
// Each one names a listed person as a self-identified Targeted Individual, with their skills and their
// listing. On the public blog the posts together formed a public list of Targeted Individuals, which
// is the reason the Directory itself sits behind a sign-in, so they moved into a private repository
// whose job pushes them here. The invites already published on the blog before that stay there, and
// are stored here marked public (column `public`, with their `blog_url`). What leaves this file:
//  - a card (name, opening, date, address in the app, and the blog address for a public invite): the
//    most a signed-out visitor, the landing site or the blog receives about a private invite. Its
//    address opens the invite by its random code, never by Quora handle, so the public route cannot
//    be used to confirm who has an invitation by guessing handles;
//  - an open card (a public invite's card, with its blog address): already public on the blog;
//  - the full invite (title, post, picture, Quora address, Directory listing): signed-in members only.

export const DIRECTORY_INVITE_PAGE_SIZE = 10;
export const DIRECTORY_INVITE_PUBLIC_CARD_COUNT = 10;

// The cards are read by the landing site and the blog, so their links are absolute.
const DEFAULT_APP_ORIGIN = 'https://app.chargingthefuture.com';

export type DirectoryInviteCard = {
  name: string;
  opening: string;
  date: string;
  url: string;
  // Only on a public invite: the blog post it was published as.
  blogUrl?: string;
};

export type DirectoryOpenInviteCard = DirectoryInviteCard & { blogUrl: string };

export type DirectoryInvite = {
  slug: string;
  inviteCode: string | null;
  name: string;
  title: string;
  opening: string;
  bodyMarkdown: string;
  date: string;
  quoraUrl: string;
  quoraHandle: string;
  directoryProfileUrl: string | null;
  image: { url: string; alt: string } | null;
  isPublic: boolean;
  blogUrl: string | null;
};

type CardRow = {
  name: string;
  opening: string;
  published_on: string;
  invite_code: string | null;
  public: boolean;
  blog_url: string | null;
};

type ImageColumns = { slug: string; has_image: boolean; image_alt: string | null; version: string };

type InviteRow = CardRow & ImageColumns & {
  quora_handle: string;
  title: string;
  body_markdown: string;
  quora_url: string;
  directory_profile_id: string | null;
};

/**
 * The app address that opens one invite by its code: the person's card for a visitor, the full invite
 * once signed in. An invite with no code yet opens the Directory page.
 */
export function inviteAppUrl(code: string | null): string {
  const origin = (getAppUrl() ?? DEFAULT_APP_ORIGIN).replace(/\/+$/, '');
  return code ? `${origin}/apps/directory?invite=${encodeURIComponent(code)}` : `${origin}/apps/directory`;
}

function toCard(row: CardRow): DirectoryInviteCard {
  const card: DirectoryInviteCard = { name: row.name, opening: row.opening, date: row.published_on, url: inviteAppUrl(row.invite_code) };
  if (row.public && row.blog_url) {
    card.blogUrl = row.blog_url;
  }
  return card;
}

// The version changes with every write, so a browser holding last week's picture asks again.
function toImage(row: ImageColumns): { url: string; alt: string } | null {
  return row.has_image
    ? { url: `/api/directory/invites/${encodeURIComponent(row.slug)}/image?v=${row.version}`, alt: row.image_alt ?? '' }
    : null;
}

function toInvite(row: InviteRow): DirectoryInvite {
  return {
    slug: row.slug,
    inviteCode: row.invite_code,
    name: row.name,
    title: row.title,
    opening: row.opening,
    bodyMarkdown: row.body_markdown,
    date: row.published_on,
    quoraUrl: row.quora_url,
    quoraHandle: row.quora_handle,
    directoryProfileUrl: row.directory_profile_id ? `/apps/directory/profile/${encodeURIComponent(row.directory_profile_id)}` : null,
    image: toImage(row),
    isPublic: row.public,
    blogUrl: row.blog_url,
  };
}

// published_on is a DATE; to_char keeps it a plain YYYY-MM-DD string rather than a Date shifted by
// the server's time zone.
// No Quora handle in a card: the public route answers cards only.
const CARD_COLUMNS = `name, opening, to_char(published_on, 'YYYY-MM-DD') AS published_on, invite_code, public, blog_url`;
const IMAGE_COLUMNS = `slug, (image IS NOT NULL) AS has_image, image_alt,
  floor(extract(epoch FROM updated_at))::bigint::text AS version`;
const INVITE_COLUMNS = `${CARD_COLUMNS}, ${IMAGE_COLUMNS}, quora_handle, title, body_markdown, quora_url, directory_profile_id`;
const NEWEST_FIRST = 'ORDER BY published_on DESC, created_at DESC, slug ASC';

export type UpsertInviteResult =
  | { status: 'created' | 'updated'; id: string }
  | { status: 'handle_taken'; slug: string }
  | { status: 'code_taken'; slug: string };

/**
 * Write one invite, keyed by slug. Every field is replaced, the picture included: an upsert without
 * a picture leaves the invite with none, so the private repository stays the one record of what an
 * invite holds. A Quora handle or an invite code already used by another slug is refused rather than
 * overwritten.
 */
export async function upsertDirectoryInvite(input: DirectoryInviteInput): Promise<UpsertInviteResult> {
  const holders = await queryDb<{ slug: string; quora_handle: string; invite_code: string | null }>(
    'SELECT slug, quora_handle, invite_code FROM directory_invites WHERE (quora_handle = $1 OR invite_code = $2) AND slug <> $3',
    [input.quoraHandle, input.inviteCode, input.slug],
  );
  const handleHolder = holders.rows.find((row) => row.quora_handle === input.quoraHandle);
  if (handleHolder) {
    return { status: 'handle_taken', slug: handleHolder.slug };
  }
  const codeHolder = holders.rows.find((row) => row.invite_code === input.inviteCode);
  if (codeHolder) {
    return { status: 'code_taken', slug: codeHolder.slug };
  }
  const result = await queryDb<{ id: string; inserted: boolean }>(
    `
      INSERT INTO directory_invites
        (slug, quora_handle, quora_url, name, title, opening, body_markdown, published_on,
         directory_profile_id, image, image_type, image_alt, public, blog_url, invite_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (slug) DO UPDATE SET
        quora_handle = EXCLUDED.quora_handle,
        invite_code = EXCLUDED.invite_code,
        quora_url = EXCLUDED.quora_url,
        name = EXCLUDED.name,
        title = EXCLUDED.title,
        opening = EXCLUDED.opening,
        body_markdown = EXCLUDED.body_markdown,
        published_on = EXCLUDED.published_on,
        directory_profile_id = EXCLUDED.directory_profile_id,
        image = EXCLUDED.image,
        image_type = EXCLUDED.image_type,
        image_alt = EXCLUDED.image_alt,
        public = EXCLUDED.public,
        blog_url = EXCLUDED.blog_url,
        updated_at = NOW()
      RETURNING id::text AS id, (xmax = 0) AS inserted
    `,
    [
      input.slug,
      input.quoraHandle,
      input.quoraUrl,
      input.name,
      input.title,
      input.opening,
      input.bodyMarkdown,
      input.publishedOn,
      input.directoryProfileId,
      // Location and camera data are removed before storing (lib/images/strip-metadata.ts).
      input.image ? Buffer.from(stripPictureMetadata(input.image.bytes)) : null,
      input.image?.contentType ?? null,
      input.image?.alt ?? null,
      input.isPublic,
      input.blogUrl,
      input.inviteCode,
    ],
  );
  const row = result.rows[0];
  return { status: row.inserted ? 'created' : 'updated', id: row.id };
}

/** Remove one invite by slug. True when a row was removed. */
export async function deleteDirectoryInviteBySlug(slug: string): Promise<boolean> {
  const result = await queryDb('DELETE FROM directory_invites WHERE slug = $1', [slug]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Remove the invites about a listing that is being deleted or taken down, inside the caller's
 * transaction, matched on the profile id and on the Quora handle in the listing's address. An invite
 * never outlives the listing it introduces.
 */
export async function deleteInvitesForListing(client: PoolClient, profileId: string, profileUrl: string | null): Promise<void> {
  const handle = profileUrl ? quoraHandleFromUrl(profileUrl) : '';
  await client.query(
    `DELETE FROM directory_invites WHERE directory_profile_id = $1 OR ($2 <> '' AND quora_handle = $2)`,
    [profileId, handle],
  );
}

/** How many people the Directory lists, by the same rule as the public counts (restricted owners left out). */
export async function countDirectoryListedPeople(): Promise<number> {
  const result = await queryDb<{ total: number }>('SELECT total FROM directory_public_totals');
  return Number(result.rows[0]?.total ?? 0);
}

export async function countDirectoryInvites(): Promise<number> {
  const result = await queryDb<{ n: string }>('SELECT COUNT(*)::text AS n FROM directory_invites');
  return Number.parseInt(result.rows[0]?.n ?? '0', 10);
}

export async function listLatestDirectoryInviteCards(limit = DIRECTORY_INVITE_PUBLIC_CARD_COUNT): Promise<DirectoryInviteCard[]> {
  const result = await queryDb<CardRow>(`SELECT ${CARD_COLUMNS} FROM directory_invites ${NEWEST_FIRST} LIMIT $1`, [limit]);
  return result.rows.map(toCard);
}

/** One invite's card by its code, for a signed-out direct link. Never looked up by Quora handle. */
export async function getDirectoryInviteCardByCode(code: string): Promise<DirectoryInviteCard | null> {
  if (!INVITE_CODE_RE.test(code)) return null;
  const result = await queryDb<CardRow>(`SELECT ${CARD_COLUMNS} FROM directory_invites WHERE invite_code = $1`, [code]);
  return result.rows[0] ? toCard(result.rows[0]) : null;
}

export async function listDirectoryInvites(limit: number, offset: number): Promise<DirectoryInvite[]> {
  const result = await queryDb<InviteRow>(
    `SELECT ${INVITE_COLUMNS} FROM directory_invites ${NEWEST_FIRST} LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows.map(toInvite);
}

/** One full invite for a signed-in reader's direct link: by invite code first, then by Quora handle. */
export async function getDirectoryInviteByCodeOrHandle(value: string): Promise<DirectoryInvite | null> {
  if (INVITE_CODE_RE.test(value)) {
    const byCode = await queryDb<InviteRow>(`SELECT ${INVITE_COLUMNS} FROM directory_invites WHERE invite_code = $1`, [value]);
    if (byCode.rows[0]) return toInvite(byCode.rows[0]);
  }
  const handle = normalizeInviteHandle(value);
  if (!handle) return null;
  const byHandle = await queryDb<InviteRow>(`SELECT ${INVITE_COLUMNS} FROM directory_invites WHERE quora_handle = $1`, [handle]);
  return byHandle.rows[0] ? toInvite(byHandle.rows[0]) : null;
}

/** The picture on one invite, for a signed-in reader of the full invitation. */
export async function readDirectoryInviteImage(slug: string): Promise<{ contentType: CommunityImageContentType; bytes: Buffer } | null> {
  const result = await queryDb<{ image: Buffer; image_type: CommunityImageContentType }>(
    'SELECT image, image_type FROM directory_invites WHERE slug = $1 AND image IS NOT NULL',
    [slug],
  );
  const row = result.rows[0];
  // Stripped on the way out too, so pictures stored before the server removed metadata are covered.
  return row ? { contentType: row.image_type, bytes: Buffer.from(stripPictureMetadata(row.image)) } : null;
}

/** Counts of public and private invites, for the signed-out page. */
export async function countDirectoryInvitesByVisibility(): Promise<{ open: number; locked: number }> {
  const result = await queryDb<{ open: string; locked: string }>(
    `SELECT COUNT(*) FILTER (WHERE public AND blog_url IS NOT NULL)::text AS open, COUNT(*) FILTER (WHERE NOT public)::text AS locked FROM directory_invites`,
  );
  return { open: Number.parseInt(result.rows[0]?.open ?? '0', 10), locked: Number.parseInt(result.rows[0]?.locked ?? '0', 10) };
}

/** One page of public invites as cards, readable by anybody: each already sits on the blog. */
export async function listOpenDirectoryInviteCards(limit: number, offset: number): Promise<DirectoryOpenInviteCard[]> {
  const result = await queryDb<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM directory_invites WHERE public AND blog_url IS NOT NULL ${NEWEST_FIRST} LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows.map((row) => ({ ...toCard(row), blogUrl: row.blog_url ?? '' }));
}

/** Quora handles that already have an invite, for the admin invite queue. */
export async function listInvitedQuoraHandles(): Promise<Set<string>> {
  const result = await queryDb<{ quora_handle: string }>('SELECT quora_handle FROM directory_invites');
  return new Set(result.rows.map((row) => row.quora_handle));
}

/** A requested page, clamped into range, with what the wall says about it ("showing X–Y of Z"). */
export function clampInvitePage(requested: unknown, total: number, pageSize = DIRECTORY_INVITE_PAGE_SIZE) {
  const parsed = typeof requested === 'string' ? Number.parseInt(requested, 10) : Number(requested);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Number.isFinite(parsed) ? Math.trunc(parsed) : 1, 1), pageCount);
  const offset = (page - 1) * pageSize;
  return { page, pageCount, pageSize, offset, from: total === 0 ? 0 : offset + 1, to: Math.min(offset + pageSize, total) };
}
