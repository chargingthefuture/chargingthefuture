import { sniffCommunityImageType, type CommunityImageContentType } from 'lib/feed/community-images';

// Checks the body the private invite repository's job sends to POST /api/internal/directory/invites.
// Pure, so the route stays small and every refusal can be tested without a database. Each refusal
// names the field it is about and what was wrong, so the job's log says what to fix (rule 137).

export const INVITE_MAX = {
  slug: 120,
  quoraHandle: 120,
  quoraUrl: 240,
  name: 120,
  title: 200,
  opening: 600,
  bodyMarkdown: 40_000,
  directoryProfileId: 64,
  blogUrl: 400,
  imageAlt: 4_000,
  imageBytes: 3 * 1024 * 1024,
} as const;

export type DirectoryInviteImageInput = {
  bytes: Uint8Array;
  contentType: CommunityImageContentType;
  alt: string;
};

export type DirectoryInviteInput = {
  slug: string;
  quoraHandle: string;
  quoraUrl: string;
  name: string;
  title: string;
  opening: string;
  bodyMarkdown: string;
  publishedOn: string;
  directoryProfileId: string | null;
  image: DirectoryInviteImageInput | null;
  // True for an invite already published on the blog before 2026-10-15: a signed-out visitor reads it
  // in the open, picture included, with a link to blogUrl. New invites are private (false).
  isPublic: boolean;
  blogUrl: string | null;
};

export type InviteInputResult =
  | { ok: true; value: DirectoryInviteInput }
  | { ok: false; field: string; message: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
// A Quora handle as it sits after /profile/ in the address, lower-cased for lookups. The address
// itself is kept exactly as sent.
const HANDLE_RE = /^[a-z0-9][a-z0-9._-]*$/;
const PROFILE_ID_RE = /^[A-Za-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Refusal = { ok: false; field: string; message: string };

function refuse(field: string, message: string): Refusal {
  return { ok: false, field, message: `${field}: ${message}` };
}

function requiredText(raw: unknown, field: string, max: number): string | Refusal {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return refuse(field, 'required, as a non-empty string.');
  }
  const value = raw.trim();
  if (value.length > max) {
    return refuse(field, `${value.length} characters is over the limit of ${max}.`);
  }
  return value;
}

function isRefusal(value: unknown): value is Refusal {
  return typeof value === 'object' && value !== null && (value as Refusal).ok === false;
}

/** Lower-cased handle after /profile/ in a Quora address, without query string or trailing slash. */
export function quoraHandleFromUrl(url: string): string {
  const withoutQuery = url.split('?')[0] ?? url;
  const afterPrefix = withoutQuery.replace(/^.*\/profile\//, '');
  return afterPrefix.replace(/\/+$/, '').toLowerCase();
}

/** Lower-cased handle, or null when it could not be one. Used for the ?invite= parameter too. */
export function normalizeInviteHandle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (value === '' || value.length > INVITE_MAX.quoraHandle || !HANDLE_RE.test(value)) return null;
  return value;
}

/** A slug as stored, or null when it could not be one. */
export function normalizeInviteSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value === '' || value.length > INVITE_MAX.slug || !SLUG_RE.test(value)) return null;
  return value;
}

function checkQuoraUrl(raw: unknown): string | Refusal {
  const value = requiredText(raw, 'quoraUrl', INVITE_MAX.quoraUrl);
  if (isRefusal(value)) return value;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return refuse('quoraUrl', 'not a valid address.');
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || !(host === 'quora.com' || host.endsWith('.quora.com'))) {
    return refuse('quoraUrl', 'must be an https address on quora.com.');
  }
  if (!parsed.pathname.includes('/profile/')) {
    return refuse('quoraUrl', 'must be a Quora profile address (…/profile/<handle>).');
  }
  return value;
}

function checkDate(raw: unknown): string | Refusal {
  if (typeof raw !== 'string' || !DATE_RE.test(raw.trim())) {
    return refuse('publishedOn', 'required, as a date written YYYY-MM-DD.');
  }
  const value = raw.trim();
  const at = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== value) {
    return refuse('publishedOn', `${value} is not a real calendar date.`);
  }
  return value;
}

function checkProfileId(raw: unknown): string | null | Refusal {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string' || raw.length > INVITE_MAX.directoryProfileId || !PROFILE_ID_RE.test(raw)) {
    return refuse('directoryProfileId', 'must be a Directory profile id (letters, digits and hyphens), or left out.');
  }
  return raw;
}

function checkPublic(raw: unknown): boolean | Refusal {
  if (raw === undefined || raw === null) return false;
  if (typeof raw !== 'boolean') return refuse('public', 'must be true or false, or left out (false).');
  return raw;
}

// `blogUrl` is the field name; `blog_url` is accepted for the same value.
function checkBlogUrl(raw: unknown, isPublic: boolean): string | null | Refusal {
  if (raw === undefined || raw === null || raw === '') {
    return isPublic ? refuse('blogUrl', 'required when public is true: the address of the published blog post.') : null;
  }
  if (typeof raw !== 'string' || raw.trim().length > INVITE_MAX.blogUrl) {
    return refuse('blogUrl', `must be an address of at most ${INVITE_MAX.blogUrl} characters.`);
  }
  try {
    if (new URL(raw.trim()).protocol !== 'https:') return refuse('blogUrl', 'must be an https address.');
  } catch {
    return refuse('blogUrl', 'not a valid address.');
  }
  return raw.trim();
}

function decodeBase64(data: string): Uint8Array | null {
  const compact = data.replace(/\s+/g, '');
  if (compact === '' || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  return new Uint8Array(Buffer.from(compact, 'base64'));
}

// The picture's bytes from base64, within the size limit, or the refusal naming image.data.
function decodeImageBytes(data: unknown): Uint8Array | Refusal {
  if (typeof data !== 'string') {
    return refuse('image.data', 'required, as the picture encoded in base64.');
  }
  // A cheap upper bound before decoding: base64 is four characters for every three bytes.
  if (data.length > Math.ceil((INVITE_MAX.imageBytes * 4) / 3) + 1024) {
    return refuse('image.data', `the picture is over the ${INVITE_MAX.imageBytes} byte limit.`);
  }
  const bytes = decodeBase64(data);
  if (!bytes) {
    return refuse('image.data', 'not valid base64.');
  }
  if (bytes.byteLength > INVITE_MAX.imageBytes) {
    return refuse('image.data', `${bytes.byteLength} bytes is over the ${INVITE_MAX.imageBytes} byte limit.`);
  }
  return bytes;
}

function checkImage(raw: unknown): DirectoryInviteImageInput | null | Refusal {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object') {
    return refuse('image', 'must be an object with data, type and alt, or left out.');
  }
  const { data, type, alt } = raw as { data?: unknown; type?: unknown; alt?: unknown };
  const bytes = decodeImageBytes(data);
  if (isRefusal(bytes)) return bytes;
  // The type is read from the picture's own bytes; the declared one has to agree with it.
  const sniffed = sniffCommunityImageType(bytes);
  if (!sniffed) {
    return refuse('image.data', 'not a PNG, JPEG or WebP picture.');
  }
  if (typeof type !== 'string' || type.trim().toLowerCase() !== sniffed) {
    return refuse('image.type', `must be ${sniffed}, which is what the picture's bytes are.`);
  }
  const altText = requiredText(alt, 'image.alt', INVITE_MAX.imageAlt);
  if (isRefusal(altText)) return altText;
  return { bytes, contentType: sniffed, alt: altText };
}

// Field checks that are plain required text, in the order a refusal is reported.
const TEXT_FIELDS = [
  ['name', INVITE_MAX.name],
  ['title', INVITE_MAX.title],
  ['opening', INVITE_MAX.opening],
  ['bodyMarkdown', INVITE_MAX.bodyMarkdown],
] as const;

type Identity = Pick<DirectoryInviteInput, 'slug' | 'quoraHandle' | 'quoraUrl'>;
type Text = Pick<DirectoryInviteInput, 'name' | 'title' | 'opening' | 'bodyMarkdown'>;
type Extras = Pick<DirectoryInviteInput, 'publishedOn' | 'directoryProfileId' | 'image' | 'isPublic' | 'blogUrl'>;

function checkIdentity(raw: Record<string, unknown>): Identity | Refusal {
  const slug = normalizeInviteSlug(raw.slug);
  if (!slug) {
    return refuse('slug', `required: lower-case letters, digits and hyphens, at most ${INVITE_MAX.slug} characters.`);
  }
  const quoraHandle = normalizeInviteHandle(raw.quoraHandle);
  if (!quoraHandle) {
    return refuse('quoraHandle', 'required: the handle after /profile/ in the Quora address.');
  }
  const quoraUrl = checkQuoraUrl(raw.quoraUrl);
  if (isRefusal(quoraUrl)) return quoraUrl;
  if (quoraHandleFromUrl(quoraUrl) !== quoraHandle) {
    return refuse('quoraHandle', `does not match the handle in quoraUrl (${quoraHandleFromUrl(quoraUrl)}).`);
  }
  return { slug, quoraHandle, quoraUrl };
}

function checkText(raw: Record<string, unknown>): Text | Refusal {
  const text: Record<string, string> = {};
  for (const [field, max] of TEXT_FIELDS) {
    const value = requiredText(raw[field], field, max);
    if (isRefusal(value)) return value;
    text[field] = value;
  }
  return { name: text.name, title: text.title, opening: text.opening, bodyMarkdown: text.bodyMarkdown };
}

function checkExtras(raw: Record<string, unknown>): Extras | Refusal {
  const publishedOn = checkDate(raw.publishedOn);
  if (isRefusal(publishedOn)) return publishedOn;
  const directoryProfileId = checkProfileId(raw.directoryProfileId);
  if (isRefusal(directoryProfileId)) return directoryProfileId;
  const image = checkImage(raw.image);
  if (isRefusal(image)) return image;
  const isPublic = checkPublic(raw.public);
  if (isRefusal(isPublic)) return isPublic;
  const blogUrl = checkBlogUrl(raw.blogUrl ?? raw.blog_url, isPublic);
  if (isRefusal(blogUrl)) return blogUrl;
  return { publishedOn, directoryProfileId, image, isPublic, blogUrl };
}

export function parseDirectoryInviteInput(body: unknown): InviteInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return refuse('body', 'must be a JSON object.');
  }
  const raw = body as Record<string, unknown>;
  const identity = checkIdentity(raw);
  if (isRefusal(identity)) return identity;
  const text = checkText(raw);
  if (isRefusal(text)) return text;
  const extras = checkExtras(raw);
  if (isRefusal(extras)) return extras;
  return { ok: true, value: { ...identity, ...text, ...extras } };
}
