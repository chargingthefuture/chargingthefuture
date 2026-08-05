import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { getCurrency } from 'lib/currency/repository';
import {
  SOCKET_RELAY_DEFAULT_PAGE,
  SOCKET_RELAY_DEFAULT_PAGE_SIZE,
  SOCKET_RELAY_MAX_DETAILS_LENGTH,
  SOCKET_RELAY_MAX_MESSAGE_LENGTH,
  SOCKET_RELAY_MAX_PAGE_SIZE,
  SOCKET_RELAY_MAX_TAG_LENGTH,
  SOCKET_RELAY_MAX_TAGS_PER_REQUEST,
  SOCKET_RELAY_MAX_TITLE_LENGTH,
} from './constants';
import type {
  SocketRelayFulfillment,
  SocketRelayMessage,
  SocketRelayProfile,
  SocketRelayProfileInput,
  SocketRelayRequest,
  SocketRelayRequestInput,
  SocketRelayRequestStatus,
  SocketRelayResolveOutcome,
} from './types';
import { ensureSocketRelayFulfillmentChannel } from './stream';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { clearMemberPresence, recordMemberPresence } from 'lib/presence/live';
import { isBlockedBetweenTx } from 'lib/blocks/repository';
import { reportError } from 'lib/observability/report';

// Cross-plugin presence: a SocketRelay help post (the Commons request a member created) marks its
// owner as active in SocketRelay. A post counts as active presence only while its status is 'open';
// the live hooks record on 'open' and clear on any other status.
const SOCKET_RELAY_PRESENCE_SLUG = 'socket-relay';
const SOCKET_RELAY_PRESENCE_REF_TYPE = 'post';
const SOCKET_RELAY_PRESENCE_LABEL = 'Help post';
const SOCKET_RELAY_PRESENCE_DEEP_LINK = '/apps/socket-relay';

// Keep the post owner's SocketRelay presence in step with a request's current status. Best-effort:
// swallows its own failure and never breaks the caller's request operation.
async function syncSocketRelayRequestPresence(
  ownerUserId: string,
  requestId: string,
  status: string | null | undefined,
): Promise<void> {
  if ((status ?? '').toLowerCase() === 'open') {
    await recordMemberPresence({
      userId: ownerUserId,
      pluginSlug: SOCKET_RELAY_PRESENCE_SLUG,
      refType: SOCKET_RELAY_PRESENCE_REF_TYPE,
      refId: requestId,
      label: SOCKET_RELAY_PRESENCE_LABEL,
      deepLink: SOCKET_RELAY_PRESENCE_DEEP_LINK,
    });
  } else {
    await clearMemberPresence({
      userId: ownerUserId,
      pluginSlug: SOCKET_RELAY_PRESENCE_SLUG,
      refType: SOCKET_RELAY_PRESENCE_REF_TYPE,
      refId: requestId,
    });
  }
}

type CountRow = { total: string };

type ProfileRow = {
  user_id: string;
  bio: string | null;
  relay_preferences: Record<string, unknown>;
  presence_opt_in: boolean;
  service_deleted_at: Date | null;
  updated_at: Date;
};

type RequestRow = {
  id: string;
  owner_user_id: string;
  owner_username: string | null;
  title: string;
  details: string;
  category: string;
  tags: string[];
  city: string | null;
  state: string | null;
  country: string | null;
  is_public: boolean;
  status: 'open' | 'claimed' | 'closed' | 'canceled';
  reopened_count: number;
  claimed_fulfillment_id: string | null;
  price_amount: string | number | null;
  price_currency: string | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
};

type FulfillmentRow = {
  id: string;
  request_id: string;
  requester_user_id: string;
  fulfiller_user_id: string;
  requester_username: string | null;
  fulfiller_username: string | null;
  status: 'active' | 'closed' | 'canceled';
  close_reason: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined for the admin list only (listAdminFulfillments). Absent on every other read, which selects
  // the bare row — hence optional rather than nullable.
  request_title?: string | null;
  request_status?: SocketRelayRequestStatus | null;
  requester_name?: string | null;
  fulfiller_name?: string | null;
};

type MessageRow = {
  id: string;
  fulfillment_id: string;
  sender_user_id: string;
  message_text: string;
  moderation_status: 'accepted' | 'flagged';
  created_at: Date;
};

type AuditInput = {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};

const PROHIBITED_PATTERNS = [/\b(?:kill|rape|murder)\b/i];

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

// Tag hygiene: trim/collapse whitespace, drop blanks, fold case-insensitive duplicates
// (first spelling wins). The per-post cap is enforced by validateRequestInput.
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeText(tag);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

// Same length rule validateRequestInput applies, exported so a route can answer a too-long tag with
// a message that names the limit instead of the generic invalid-payload one.
export function hasOverlongTag(tags: string[]): boolean {
  return normalizeTags(tags).some((tag) => tag.length > SOCKET_RELAY_MAX_TAG_LENGTH);
}

// Legacy rows predate the tags column; fall back to the single category.
function rowTags(row: RequestRow): string[] {
  if (Array.isArray(row.tags) && row.tags.length > 0) return row.tags;
  return row.category ? [row.category] : [];
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function mapProfileRow(row: ProfileRow): SocketRelayProfile {
  return {
    userId: row.user_id,
    bio: row.bio,
    relayPreferences: row.relay_preferences ?? {},
    presenceOptIn: row.presence_opt_in,
    serviceDeletedAtIso: row.service_deleted_at ? toIso(row.service_deleted_at) : null,
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapRequestRow(row: RequestRow): SocketRelayRequest {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username,
    title: row.title,
    details: row.details,
    category: row.category,
    tags: rowTags(row),
    city: row.city,
    state: row.state,
    country: row.country,
    isPublic: row.is_public,
    status: row.status,
    reopenedCount: row.reopened_count,
    claimedFulfillmentId: row.claimed_fulfillment_id,
    priceCurrency: row.price_currency,
    priceAmount: row.price_amount === null || row.price_amount === undefined ? null : Number(row.price_amount),
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
    expiresAtIso: row.expires_at ? toIso(row.expires_at) : null,
    // A post auto-expires 28 days after it is posted or re-posted. It only counts as expired while it is
    // still open and waiting (a claimed/closed/canceled post is not "expired"). Derived here so the
    // whole app reads the same expiry without a scheduled job flipping a status column.
    isExpired: row.status === 'open' && row.expires_at != null && new Date(row.expires_at).getTime() < Date.now(),
  };
}

function mapFulfillmentRow(row: FulfillmentRow): SocketRelayFulfillment {
  return {
    id: row.id,
    requestId: row.request_id,
    requesterUserId: row.requester_user_id,
    fulfillerUserId: row.fulfiller_user_id,
    requesterUsername: row.requester_username ?? null,
    fulfillerUsername: row.fulfiller_username ?? null,
    status: row.status,
    closeReason: row.close_reason,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
    requestTitle: row.request_title ?? undefined,
    requestStatus: row.request_status ?? undefined,
    requesterName: row.requester_name ?? null,
    fulfillerName: row.fulfiller_name ?? null,
  };
}

function mapMessageRow(row: MessageRow): SocketRelayMessage {
  return {
    id: row.id,
    fulfillmentId: row.fulfillment_id,
    senderUserId: row.sender_user_id,
    messageText: row.message_text,
    moderationStatus: row.moderation_status,
    createdAtIso: toIso(row.created_at),
  };
}

export function validateProfileInput(input: SocketRelayProfileInput): boolean {
  const bio = normalizeNullableText(input.bio);

  if (bio && bio.length > 2000) {
    return false;
  }

  if (typeof input.presenceOptIn !== 'boolean') {
    return false;
  }

  // Wrap in Boolean(): a bare `obj && … && …` returns the object (truthy) rather than `true`, so a
  // caller comparing `=== true` would get a false negative. Always return a genuine boolean.
  return Boolean(input.relayPreferences && typeof input.relayPreferences === 'object' && !Array.isArray(input.relayPreferences));
}

// Per-field validators for validateRequestInput, split out so the top-level check stays under the
// complexity limit. Each mirrors the exact rule it replaced.
function isValidRequestTitle(title: string): boolean {
  return title.length > 0 && title.length <= SOCKET_RELAY_MAX_TITLE_LENGTH;
}

function isValidRequestDetails(details: string): boolean {
  return details.length > 0 && details.length <= SOCKET_RELAY_MAX_DETAILS_LENGTH;
}

function isValidRequestTags(tags: string[]): boolean {
  if (tags.length === 0 || tags.length > SOCKET_RELAY_MAX_TAGS_PER_REQUEST) {
    return false;
  }
  return !hasOverlongTag(tags);
}

function isValidOptionalLocationField(value: string | null): boolean {
  return !value || value.length <= 120;
}

export function validateRequestInput(input: SocketRelayRequestInput): boolean {
  const title = normalizeText(input.title);
  const details = normalizeText(input.details);
  const tags = normalizeTags(input.tags);

  if (!isValidRequestTitle(title)) {
    return false;
  }

  if (!isValidRequestDetails(details)) {
    return false;
  }

  if (!isValidRequestTags(tags)) {
    return false;
  }

  if (typeof input.isPublic !== 'boolean') {
    return false;
  }

  const city = normalizeNullableText(input.city);
  const state = normalizeNullableText(input.state);
  const country = normalizeNullableText(input.country);
  return isValidOptionalLocationField(city) && isValidOptionalLocationField(state) && isValidOptionalLocationField(country);
}

// Validate the chosen value type + amount against the currency catalog (issue #420). No value type
// (both null) is allowed. Otherwise the code must be an active currency, and the amount must be a
// positive number for priced types (requires_amount) and null for amount-less types (Free, Barter).
export async function isValidRequestPrice(priceCurrency: string | null, priceAmount: number | null): Promise<boolean> {
  if (priceCurrency === null) {
    return priceAmount === null;
  }
  const currency = await getCurrency(priceCurrency);
  if (!currency || !currency.isActive) {
    return false;
  }
  if (currency.requiresAmount) {
    return typeof priceAmount === 'number' && Number.isFinite(priceAmount) && priceAmount > 0;
  }
  return priceAmount === null;
}

export function validateMessageInput(messageText: string): boolean {
  const normalized = normalizeText(messageText);
  if (normalized.length === 0 || normalized.length > SOCKET_RELAY_MAX_MESSAGE_LENGTH) {
    return false;
  }

  return !PROHIBITED_PATTERNS.some((pattern) => pattern.test(normalized));
}

function normalizePage(value: number | null | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return SOCKET_RELAY_DEFAULT_PAGE;
  }

  return value;
}

function normalizePageSize(value: number | null | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return SOCKET_RELAY_DEFAULT_PAGE_SIZE;
  }

  return Math.min(value, SOCKET_RELAY_MAX_PAGE_SIZE);
}

export async function getProfile(userId: string): Promise<SocketRelayProfile | null> {
  const result = await queryDb<ProfileRow>(
    `SELECT user_id, bio, relay_preferences, presence_opt_in, service_deleted_at, updated_at
     FROM socket_relay_user_extension
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return mapProfileRow(result.rows[0]);
}

export async function upsertProfile(userId: string, input: SocketRelayProfileInput): Promise<SocketRelayProfile> {
  const result = await queryDb<ProfileRow>(
    `INSERT INTO socket_relay_user_extension (
       user_id,
       bio,
       relay_preferences,
       presence_opt_in,
       service_deleted_at,
       updated_at
     ) VALUES (
       $1,
       $2,
       $3::jsonb,
       $4,
       NULL,
       NOW()
     )
     ON CONFLICT (user_id)
     DO UPDATE SET
       bio = EXCLUDED.bio,
       relay_preferences = EXCLUDED.relay_preferences,
       presence_opt_in = EXCLUDED.presence_opt_in,
       service_deleted_at = NULL,
       updated_at = NOW()
     RETURNING user_id, bio, relay_preferences, presence_opt_in, service_deleted_at, updated_at`,
    [
      userId,
      normalizeNullableText(input.bio),
      JSON.stringify(normalizeJsonObject(input.relayPreferences)),
      input.presenceOptIn,
    ],
  );

  return mapProfileRow(result.rows[0]);
}

export async function deleteProfile(userId: string): Promise<void> {
  await queryDb(
    `UPDATE socket_relay_user_extension
     SET service_deleted_at = NOW(), updated_at = NOW()
     WHERE user_id = $1`,
    [userId],
  );
}

export async function createRequest(actorUserId: string, actorUsername: string | null, input: SocketRelayRequestInput, idempotencyKey: string): Promise<SocketRelayRequest> {
  if (!(await isValidRequestPrice(input.priceCurrency, input.priceAmount))) {
    throw new Error('invalid_request_price');
  }

  const request = await withDbTransaction(async (client) => {
    const existing = await client.query<RequestRow>(
      `SELECT id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at
       FROM socket_relay_requests
       WHERE owner_user_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [actorUserId, idempotencyKey],
    );

    if ((existing.rowCount ?? 0) > 0) {
      return mapRequestRow(existing.rows[0]);
    }

    const tags = normalizeTags(input.tags);
    const created = await client.query<RequestRow>(
      `INSERT INTO socket_relay_requests (
         owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, idempotency_key, price_amount, price_currency, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10, 'open', $11, $12, $13, NOW() + INTERVAL '28 days')
       RETURNING id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at`,
      [
        actorUserId,
        normalizeNullableText(actorUsername),
        normalizeText(input.title),
        normalizeText(input.details),
        tags[0],
        tags,
        normalizeNullableText(input.city),
        normalizeNullableText(input.state),
        normalizeNullableText(input.country),
        input.isPublic,
        idempotencyKey,
        input.priceAmount,
        input.priceCurrency,
      ],
    );

    await client.query(
      `INSERT INTO socket_relay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_created', '{}'::jsonb)`,
      [created.rows[0].id, actorUserId],
    );

    return mapRequestRow(created.rows[0]);
  });

  // Best-effort presence write after the post is durably committed: a new open post makes its owner
  // active in SocketRelay. Never breaks request creation.
  await syncSocketRelayRequestPresence(request.ownerUserId, request.id, request.status);

  return request;
}

type ListRequestsOptions = {
  page?: number;
  pageSize?: number;
  ownerUserId?: string;
  statuses?: SocketRelayRequestStatus[];
  // When set, requests whose owner is blocked (either direction) relative to this viewer are hidden
  // (issue #809 task 4). Pass the signed-in member for the browse feed; leave unset for admin lists
  // and owner-scoped lists, which must stay complete.
  viewerUserId?: string;
};

function normalizeListRequestsOptions(options?: ListRequestsOptions) {
  const page = normalizePage(options?.page);
  const pageSize = normalizePageSize(options?.pageSize);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    ownerUserId: normalizeNullableText(options?.ownerUserId ?? null),
    // Optional status scoping. The member feed asks for open (claimable) requests only, so resolved
    // and claimed posts do not crowd out open ones on a page. Null means every status — the owner
    // "Mine" / Direct Line lists and the admin list all keep their full-status view.
    statuses: options?.statuses && options.statuses.length > 0 ? options.statuses : null,
    viewerUserId: normalizeNullableText(options?.viewerUserId ?? null),
  };
}

export async function listRequests(options?: ListRequestsOptions): Promise<{ items: SocketRelayRequest[]; page: number; pageSize: number; total: number }> {
  const { page, pageSize, offset, ownerUserId, statuses, viewerUserId } = normalizeListRequestsOptions(options);

  // Mirrors the LightHouse browse filter: a `IS NULL` arm keeps this a no-op when no viewer is passed.
  const hideBlockedOwnersSql = `
       AND ($3::text IS NULL OR NOT EXISTS (
         SELECT 1
         FROM member_blocks
         WHERE (blocker_user_id = $3 AND blocked_user_id = socket_relay_requests.owner_user_id)
            OR (blocker_user_id = socket_relay_requests.owner_user_id AND blocked_user_id = $3)
       ))`;

  const count = await queryDb<CountRow>(
    `SELECT COUNT(*)::text AS total
     FROM socket_relay_requests
     WHERE ($1::text IS NULL OR owner_user_id = $1)
       AND ($2::text[] IS NULL OR status = ANY($2))${hideBlockedOwnersSql}`,
    [ownerUserId, statuses, viewerUserId],
  );

  const total = Number.parseInt(count.rows[0]?.total ?? '0', 10);

  const result = await queryDb<RequestRow>(
    `SELECT id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at
     FROM socket_relay_requests
     WHERE ($1::text IS NULL OR owner_user_id = $1)
       AND ($2::text[] IS NULL OR status = ANY($2))${hideBlockedOwnersSql}
     ORDER BY created_at DESC
     OFFSET $4 LIMIT $5`,
    [ownerUserId, statuses, viewerUserId, offset, pageSize],
  );

  return {
    items: result.rows.map(mapRequestRow),
    page,
    pageSize,
    total,
  };
}

export async function getRequestById(requestId: string): Promise<SocketRelayRequest | null> {
  const result = await queryDb<RequestRow>(
    `SELECT id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at
     FROM socket_relay_requests
     WHERE id = $1::uuid
     LIMIT 1`,
    [requestId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return mapRequestRow(result.rows[0]);
}

export async function updateRequest(requestId: string, actorUserId: string, isAdmin: boolean, input: SocketRelayRequestInput): Promise<SocketRelayRequest> {
  if (!(await isValidRequestPrice(input.priceCurrency, input.priceAmount))) {
    throw new Error('invalid_request_price');
  }

  const existing = await getRequestById(requestId);
  if (!existing) {
    throw new Error('request_not_found');
  }

  if (!isAdmin && existing.ownerUserId !== actorUserId) {
    throw new Error('not_owner');
  }

  const tags = normalizeTags(input.tags);
  // Update the row and log a `request_updated` lifecycle event in the same transaction, so an edit
  // leaves a `request_events` entry just like create/claim/resolve do (the lifecycle log is otherwise
  // silent on edits).
  const request = await withDbTransaction(async (client) => {
    const result = await client.query<RequestRow>(
      `UPDATE socket_relay_requests
       SET title = $2,
           details = $3,
           category = $4,
           tags = $5::text[],
           city = $6,
           state = $7,
           country = $8,
           is_public = $9,
           price_amount = $10,
           price_currency = $11,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at`,
      [
        requestId,
        normalizeText(input.title),
        normalizeText(input.details),
        tags[0],
        tags,
        normalizeNullableText(input.city),
        normalizeNullableText(input.state),
        normalizeNullableText(input.country),
        input.isPublic,
        input.priceAmount,
        input.priceCurrency,
      ],
    );

    // The row could have been deleted between the getRequestById check above and this UPDATE (e.g. a
    // concurrent admin delete); without this guard `rows[0]` is undefined and mapRequestRow throws an
    // opaque TypeError → 500 instead of a clean request_not_found.
    if ((result.rowCount ?? 0) === 0) {
      throw new Error('request_not_found');
    }

    await client.query(
      `INSERT INTO socket_relay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_updated', '{}'::jsonb)`,
      [requestId, actorUserId],
    );

    return mapRequestRow(result.rows[0]);
  });

  // Best-effort presence sync after the durable update: keeps presence (and its label) in step with
  // the post's current status. Never breaks the update.
  await syncSocketRelayRequestPresence(request.ownerUserId, request.id, request.status);

  return request;
}

export async function repostRequest(requestId: string, actorUserId: string, isAdmin: boolean): Promise<SocketRelayRequest> {
  const existing = await getRequestById(requestId);
  if (!existing) {
    throw new Error('request_not_found');
  }

  if (!isAdmin && existing.ownerUserId !== actorUserId) {
    throw new Error('not_owner');
  }

  const request = await withDbTransaction(async (client) => {
    // Lock the row and re-check status UNDER the lock. A claimed request has an active helper and a live
    // Direct Line; re-posting it would blank `claimed_fulfillment_id` and set the request back to `open`
    // while its fulfillment stays `active` — a request that is at once a live conversation and a "waiting
    // for a helper" row, re-claimable by a second helper. The earlier ownership read is unlocked, so a
    // concurrent claim could flip the status in between; the FOR UPDATE lock + the `status <> 'claimed'`
    // predicate on the UPDATE close that race. Repost is for expired/closed posts only.
    const locked = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM socket_relay_requests WHERE id = $1::uuid FOR UPDATE`,
      [requestId],
    );
    if ((locked.rowCount ?? 0) === 0) {
      throw new Error('request_not_found');
    }
    if (locked.rows[0].status === 'claimed') {
      throw new Error('request_not_repostable');
    }

    const updated = await client.query<RequestRow>(
      `UPDATE socket_relay_requests
       SET status = 'open',
           reopened_count = reopened_count + 1,
           claimed_fulfillment_id = NULL,
           updated_at = NOW(),
           expires_at = NOW() + INTERVAL '28 days'
       WHERE id = $1::uuid AND status <> 'claimed'
       RETURNING id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at`,
      [requestId],
    );
    if ((updated.rowCount ?? 0) === 0) {
      throw new Error('request_not_repostable');
    }

    // Log the lifecycle event in the same transaction, mirroring create/update/claim/resolve — a repost
    // re-enters the post into the claimable pool with a fresh expiry, so it belongs in the event log.
    await client.query(
      `INSERT INTO socket_relay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_reposted', '{}'::jsonb)`,
      [requestId, actorUserId],
    );

    return mapRequestRow(updated.rows[0]);
  });

  // Best-effort presence write after the durable repost: the post is back to open, so its owner is
  // active again in SocketRelay. Never breaks the repost.
  await syncSocketRelayRequestPresence(request.ownerUserId, request.id, request.status);

  return request;
}

// Idempotency arm of claimRequest: a network retry after the first claim already committed finds the
// request 'claimed'. If it was claimed by THIS actor, return the existing active fulfillment instead
// of erroring — the command contract marks claim idempotent, so a retry of a claim that actually
// succeeded reads as success, not `request_not_claimable`. Another member's claim returns null.
async function findExistingActiveClaim(
  client: PoolClient,
  requestRow: RequestRow,
  actorUserId: string,
): Promise<SocketRelayFulfillment | null> {
  if (requestRow.status !== 'claimed') {
    return null;
  }
  const existing = await client.query<FulfillmentRow>(
    `SELECT id, request_id, requester_user_id, fulfiller_user_id, requester_username, fulfiller_username, status, close_reason, created_at, updated_at
     FROM socket_relay_fulfillments
     WHERE request_id = $1::uuid AND fulfiller_user_id = $2 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [requestRow.id, actorUserId],
  );
  return (existing.rowCount ?? 0) > 0 ? mapFulfillmentRow(existing.rows[0]) : null;
}

export async function claimRequest(requestId: string, actorUserId: string, actorUsername: string | null = null): Promise<{ request: SocketRelayRequest; fulfillment: SocketRelayFulfillment }> {
  const created = await withDbTransaction(async (client) => {
    const requestResult = await client.query<RequestRow>(
      `SELECT id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at
       FROM socket_relay_requests
       WHERE id = $1::uuid
       LIMIT 1
       FOR UPDATE`,
      [requestId],
    );

    if ((requestResult.rowCount ?? 0) === 0) {
      throw new Error('request_not_found');
    }

    const requestRow = requestResult.rows[0];

    if (requestRow.owner_user_id === actorUserId) {
      throw new Error('actor_is_owner');
    }

    // Block check (issue #809 task 4): a blocked pair must not be joined into a Direct Line. Checked
    // before the idempotency branch so a blocked retry cannot resurrect an old claim either. The
    // route maps blocked_pair to neutral copy so the block never reveals itself.
    if (await isBlockedBetweenTx(client, actorUserId, requestRow.owner_user_id)) {
      throw new Error('blocked_pair');
    }

    if (requestRow.status !== 'open') {
      const existing = await findExistingActiveClaim(client, requestRow, actorUserId);
      if (existing) {
        return { request: mapRequestRow(requestRow), fulfillment: existing };
      }
      throw new Error('request_not_claimable');
    }

    // An open post past its 28-day expiry is no longer claimable — the owner must re-post it first.
    if (requestRow.expires_at != null && new Date(requestRow.expires_at).getTime() < Date.now()) {
      throw new Error('request_expired');
    }

    const fulfillment = await client.query<FulfillmentRow>(
      `INSERT INTO socket_relay_fulfillments (request_id, requester_user_id, fulfiller_user_id, requester_username, fulfiller_username, status)
       VALUES ($1::uuid, $2, $3, $4, $5, 'active')
       RETURNING id, request_id, requester_user_id, fulfiller_user_id, requester_username, fulfiller_username, status, close_reason, created_at, updated_at`,
      [requestId, requestRow.owner_user_id, actorUserId, normalizeNullableText(requestRow.owner_username), normalizeNullableText(actorUsername)],
    );

    await client.query(
      `INSERT INTO socket_relay_fulfillment_participants (fulfillment_id, user_id, participant_role)
       VALUES ($1::uuid, $2, 'requester'), ($1::uuid, $3, 'fulfiller')
       ON CONFLICT (fulfillment_id, user_id) DO NOTHING`,
      [fulfillment.rows[0].id, requestRow.owner_user_id, actorUserId],
    );

    const requestUpdate = await client.query<RequestRow>(
      `UPDATE socket_relay_requests
       SET status = 'claimed', claimed_fulfillment_id = $2::uuid, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at`,
      [requestId, fulfillment.rows[0].id],
    );

    await client.query(
      `INSERT INTO socket_relay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_claimed', jsonb_build_object('fulfillmentId', $3::uuid))`,
      [requestId, actorUserId, fulfillment.rows[0].id],
    );

    return {
      request: mapRequestRow(requestUpdate.rows[0]),
      fulfillment: mapFulfillmentRow(fulfillment.rows[0]),
    };
  });

  // Resolve readable display names for the Stream channel instead of raw user UUIDs. Both handles are
  // now captured on the fulfillment at claim time (requester = the request's owner_username; fulfiller =
  // the claimer's own username), so both participants render with a real @handle in chat. The chat
  // route reads these same stored handles on every open, so a later open never degrades them.
  //
  // Best-effort: the claim is already durably committed above, so a Stream outage here must NOT throw
  // out of claimRequest — that would make the fulfill route return 500, skip its audit row and the
  // "someone offered to help" notification, and leave a retry stuck on `request_not_claimable` for a
  // claim that actually succeeded. The chat-credentials route re-ensures the channel on first open, so
  // it self-heals; here we just log and move on.
  try {
    await ensureSocketRelayFulfillmentChannel({
      fulfillmentId: created.fulfillment.id,
      requesterUserId: created.fulfillment.requesterUserId,
      requesterDisplayName: buildIdentityDisplayName(created.fulfillment.requesterUsername, created.fulfillment.requesterUserId),
      fulfillerUserId: created.fulfillment.fulfillerUserId,
      fulfillerDisplayName: buildIdentityDisplayName(created.fulfillment.fulfillerUsername, created.fulfillment.fulfillerUserId),
    });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'claim_ensure_channel' });
  }

  // Best-effort presence sync after the durable claim: the post left the open pool (status 'claimed'),
  // so its owner's presence for this post is cleared. Never breaks the claim.
  await syncSocketRelayRequestPresence(created.request.ownerUserId, created.request.id, created.request.status);

  return created;
}

export async function getFulfillmentById(fulfillmentId: string): Promise<SocketRelayFulfillment | null> {
  const result = await queryDb<FulfillmentRow>(
    `SELECT id, request_id, requester_user_id, fulfiller_user_id, requester_username, fulfiller_username, status, close_reason, created_at, updated_at
     FROM socket_relay_fulfillments
     WHERE id = $1::uuid
     LIMIT 1`,
    [fulfillmentId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return mapFulfillmentRow(result.rows[0]);
}

export async function listMyFulfillments(userId: string): Promise<SocketRelayFulfillment[]> {
  // Join the request so the chat can show what the conversation is about (title + current status)
  // instead of a bare "Fulfillment <uuid>", and both participants' real names so the header can say
  // WHO the other person is. The usernames captured at claim time are null for anyone without a
  // handle, which left a member with no way to tell who had offered to help — the whole point of
  // being able to open a past conversation (owner report).
  const result = await queryDb<FulfillmentRow & { request_title: string | null; request_status: string | null }>(
    `SELECT f.id, f.request_id, f.requester_user_id, f.fulfiller_user_id, f.requester_username, f.fulfiller_username, f.status, f.close_reason, f.created_at, f.updated_at,
            r.title AS request_title, r.status AS request_status,
            NULLIF(TRIM(COALESCE(rp.first_name, '') || ' ' || COALESCE(rp.last_name, '')), '') AS requester_name,
            NULLIF(TRIM(COALESCE(fp.first_name, '') || ' ' || COALESCE(fp.last_name, '')), '') AS fulfiller_name
     FROM socket_relay_fulfillments f
     LEFT JOIN socket_relay_requests r ON r.id = f.request_id
     LEFT JOIN directory_profiles rp
       ON rp.claimed_by_user_id = f.requester_user_id AND rp.deleted_at IS NULL
     LEFT JOIN directory_profiles fp
       ON fp.claimed_by_user_id = f.fulfiller_user_id AND fp.deleted_at IS NULL
     WHERE f.requester_user_id = $1 OR f.fulfiller_user_id = $1
     ORDER BY f.created_at DESC`,
    [userId],
  );

  return result.rows.map((row) => ({
    ...mapFulfillmentRow(row),
    requestTitle: row.request_title ?? undefined,
    requestStatus: (row.request_status as SocketRelayRequestStatus | null) ?? undefined,
  }));
}

async function ensureFulfillmentParticipant(fulfillmentId: string, actorUserId: string, isAdmin: boolean): Promise<SocketRelayFulfillment> {
  const fulfillment = await getFulfillmentById(fulfillmentId);
  if (!fulfillment) {
    throw new Error('fulfillment_not_found');
  }

  if (isAdmin) {
    return fulfillment;
  }

  const isParticipant = fulfillment.requesterUserId === actorUserId || fulfillment.fulfillerUserId === actorUserId;
  if (!isParticipant) {
    throw new Error('actor_not_participant');
  }

  return fulfillment;
}

// The status/event triples a resolve applies, derived once from the outcome so resolveFulfillment
// does not repeat the same `reopen ? … : …` branch three times. `unsuccessful_reopen` cancels this
// helper and puts the request back to open; every other outcome closes both.
type ResolveOutcomePlan = {
  fulfillmentStatus: 'canceled' | 'closed';
  requestStatus: 'open' | 'closed';
  eventName: 'fulfillment_reopened' | 'fulfillment_closed';
};

function resolveOutcomePlan(outcome: SocketRelayResolveOutcome): ResolveOutcomePlan {
  if (outcome === 'unsuccessful_reopen') {
    return { fulfillmentStatus: 'canceled', requestStatus: 'open', eventName: 'fulfillment_reopened' };
  }
  return { fulfillmentStatus: 'closed', requestStatus: 'closed', eventName: 'fulfillment_closed' };
}

// Resolve a claimed request. Only the REQUESTER (the person who posted it) or an admin may resolve —
// a helper can chat on the Direct Line but cannot close someone else's request. The requester picks
// one of four outcomes; `unsuccessful_reopen` cancels this helper and puts the request back to open
// so others can offer, while the other three close the request (the outcome is kept in close_reason).
export async function resolveFulfillment(
  fulfillmentId: string,
  actorUserId: string,
  isAdmin: boolean,
  outcome: SocketRelayResolveOutcome,
): Promise<SocketRelayFulfillment> {
  const { result, ownerUserId, requestId, requestStatus } = await withDbTransaction(async (client) => {
    // Lock the row inside the transaction and require it to still be active, so a concurrent or
    // retried resolve can't both pass checks and double-apply side effects (e.g. incrementing
    // reopened_count twice or inserting duplicate request events).
    const locked = await client.query<FulfillmentRow>(
      `SELECT id, request_id, requester_user_id, fulfiller_user_id, requester_username, fulfiller_username, status, close_reason, created_at, updated_at
       FROM socket_relay_fulfillments
       WHERE id = $1::uuid
       FOR UPDATE`,
      [fulfillmentId],
    );
    if ((locked.rowCount ?? 0) === 0) {
      throw new Error('fulfillment_not_found');
    }
    const fulfillment = mapFulfillmentRow(locked.rows[0]);
    // The requester is the request owner; the fulfiller (helper) cannot resolve.
    if (!isAdmin && fulfillment.requesterUserId !== actorUserId) {
      throw new Error('actor_not_requester');
    }
    if (fulfillment.status !== 'active') {
      throw new Error('fulfillment_not_active');
    }

    const reopen = outcome === 'unsuccessful_reopen';
    const plan = resolveOutcomePlan(outcome);

    const updated = await client.query<FulfillmentRow>(
      `UPDATE socket_relay_fulfillments
       SET status = $3, close_reason = $2, updated_at = NOW()
       WHERE id = $1::uuid AND status = 'active'
       RETURNING id, request_id, requester_user_id, fulfiller_user_id, requester_username, fulfiller_username, status, close_reason, created_at, updated_at`,
      [fulfillmentId, outcome, plan.fulfillmentStatus],
    );
    if ((updated.rowCount ?? 0) === 0) {
      throw new Error('fulfillment_not_active');
    }

    if (reopen) {
      // Put the request back into the open pool for other helpers (mirrors repost) — including resetting
      // the 28-day expiry clock. Without this a helper-canceled reopen would keep the original
      // expires_at, so a post that had aged close to (or past) expiry would come back already expired and
      // be immediately un-claimable, forcing the owner to re-post manually.
      await client.query(
        `UPDATE socket_relay_requests
         SET status = 'open', claimed_fulfillment_id = NULL, reopened_count = reopened_count + 1,
             expires_at = NOW() + INTERVAL '28 days', updated_at = NOW()
         WHERE id = $1::uuid`,
        [fulfillment.requestId],
      );
    } else {
      await client.query(
        `UPDATE socket_relay_requests
         SET status = 'closed', updated_at = NOW()
         WHERE id = $1::uuid`,
        [fulfillment.requestId],
      );
    }

    await client.query(
      `INSERT INTO socket_relay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, $3, jsonb_build_object('outcome', $4::text))`,
      [fulfillment.requestId, actorUserId, plan.eventName, outcome],
    );

    return {
      result: mapFulfillmentRow(updated.rows[0]),
      // The requester is the request owner (see this function's doc comment).
      ownerUserId: fulfillment.requesterUserId,
      requestId: fulfillment.requestId,
      requestStatus: plan.requestStatus,
    };
  });

  // Best-effort presence sync after the durable resolve: a reopen puts the post back to open (owner
  // active again); any close clears the owner's presence for this post. Never breaks the resolve.
  await syncSocketRelayRequestPresence(ownerUserId, requestId, requestStatus);

  return result;
}

export async function listFulfillmentMessages(fulfillmentId: string, actorUserId: string, isAdmin: boolean): Promise<SocketRelayMessage[]> {
  await ensureFulfillmentParticipant(fulfillmentId, actorUserId, isAdmin);

  const result = await queryDb<MessageRow>(
    `SELECT id, fulfillment_id, sender_user_id, message_text, moderation_status, created_at
     FROM socket_relay_messages
     WHERE fulfillment_id = $1::uuid
     ORDER BY created_at ASC`,
    [fulfillmentId],
  );

  return result.rows.map(mapMessageRow);
}

export async function sendFulfillmentMessage(
  fulfillmentId: string,
  actorUserId: string,
  isAdmin: boolean,
  messageText: string,
  clientMessageId: string,
): Promise<SocketRelayMessage> {
  const fulfillment = await ensureFulfillmentParticipant(fulfillmentId, actorUserId, isAdmin);

  if (fulfillment.status !== 'active') {
    throw new Error('request_not_claimable');
  }

  if (!validateMessageInput(messageText)) {
    throw new Error('prohibited_content_detected');
  }

  const result = await queryDb<MessageRow>(
    `INSERT INTO socket_relay_messages (fulfillment_id, sender_user_id, message_text, client_message_id, moderation_status)
     VALUES ($1::uuid, $2, $3, $4, 'accepted')
     ON CONFLICT (fulfillment_id, sender_user_id, client_message_id)
     DO UPDATE SET message_text = socket_relay_messages.message_text
     RETURNING id, fulfillment_id, sender_user_id, message_text, moderation_status, created_at`,
    [fulfillmentId, actorUserId, normalizeText(messageText), normalizeText(clientMessageId)],
  );

  return mapMessageRow(result.rows[0]);
}

export async function listAdminRequests(options?: { page?: number; pageSize?: number }) {
  return listRequests({ page: options?.page, pageSize: options?.pageSize });
}

// Admin fulfillment list, enriched so the screen is readable without a lookup.
//
// It used to select the bare row, so the admin screen could only print the request UUID and two Clerk
// user ids. Identifying who offered to help meant copying an id, finding the request another way, and
// cross-referencing by hand (owner report). The request title and each participant's real name are
// joined here instead: a name that is on file is shown, and the raw id survives only as the last
// resort when a member has neither a directory profile nor a handle.
export async function listAdminFulfillments(): Promise<SocketRelayFulfillment[]> {
  const result = await queryDb<FulfillmentRow>(
    `SELECT
       f.id, f.request_id, f.requester_user_id, f.fulfiller_user_id,
       f.requester_username, f.fulfiller_username, f.status, f.close_reason,
       f.created_at, f.updated_at,
       r.title AS request_title,
       r.status AS request_status,
       NULLIF(TRIM(COALESCE(rp.first_name, '') || ' ' || COALESCE(rp.last_name, '')), '') AS requester_name,
       NULLIF(TRIM(COALESCE(fp.first_name, '') || ' ' || COALESCE(fp.last_name, '')), '') AS fulfiller_name
     FROM socket_relay_fulfillments f
     LEFT JOIN socket_relay_requests r ON r.id = f.request_id
     LEFT JOIN directory_profiles rp
       ON rp.claimed_by_user_id = f.requester_user_id AND rp.deleted_at IS NULL
     LEFT JOIN directory_profiles fp
       ON fp.claimed_by_user_id = f.fulfiller_user_id AND fp.deleted_at IS NULL
     ORDER BY f.created_at DESC`,
  );

  return result.rows.map(mapFulfillmentRow);
}

export async function adminDeleteRequest(requestId: string, audit: AuditInput): Promise<void> {
  // These tables carry no ON DELETE CASCADE (they are plain UUID columns, not FKs), so deleting the
  // request alone would leave orphaned fulfillments, participants, and lifecycle events pointing at a
  // row that no longer exists. Remove them in one transaction so the delete is deterministic. The
  // fulfillment chat messages (`socket_relay_messages`) are deliberately NOT deleted here: per the
  // deletion contract (rule 100) they are retained server-side as moderation/abuse evidence; once their
  // fulfillment row is gone they are simply unreachable through the participant-gated read path.
  const deleted = await withDbTransaction(async (client) => {
    const result = await client.query<RequestRow>(
      `DELETE FROM socket_relay_requests
       WHERE id = $1::uuid
       RETURNING id, owner_user_id, owner_username, title, details, category, tags, city, state, country, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at, expires_at`,
      [requestId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('request_not_found');
    }

    await client.query(
      `DELETE FROM socket_relay_fulfillment_participants
       WHERE fulfillment_id IN (SELECT id FROM socket_relay_fulfillments WHERE request_id = $1::uuid)`,
      [requestId],
    );
    await client.query(`DELETE FROM socket_relay_fulfillments WHERE request_id = $1::uuid`, [requestId]);
    await client.query(`DELETE FROM socket_relay_request_events WHERE request_id = $1::uuid`, [requestId]);

    // Write the audit row in the SAME transaction as the delete, so the removal is never committed
    // without its audit record (if the audit insert fails, the whole delete rolls back).
    const auditQuery = socketRelayAuditInsert(audit);
    await client.query(auditQuery.text, auditQuery.params);

    return mapRequestRow(result.rows[0]);
  });

  // Best-effort presence clear after the post row is durably removed. Never breaks the delete.
  await clearMemberPresence({
    userId: deleted.ownerUserId,
    pluginSlug: SOCKET_RELAY_PRESENCE_SLUG,
    refType: SOCKET_RELAY_PRESENCE_REF_TYPE,
    refId: deleted.id,
  });
}

// The audit INSERT, split out so it can run either on its own connection (`insertSocketRelayAudit`)
// or inside an existing transaction (e.g. admin delete, so the delete and its audit row are atomic).
function socketRelayAuditInsert(input: AuditInput): { text: string; params: unknown[] } {
  return {
    text: `INSERT INTO socket_relay_admin_audit_trail (
       actor_id,
       command,
       policy_status,
       reason,
       target_type,
       target_id,
       metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    params: [
      input.actorId,
      input.command,
      input.policyStatus,
      input.reason,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
    ],
  };
}

export async function insertSocketRelayAudit(input: AuditInput): Promise<void> {
  const { text, params } = socketRelayAuditInsert(input);
  await queryDb(text, params);
}
