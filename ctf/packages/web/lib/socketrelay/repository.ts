import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { getCurrency } from 'lib/currency/repository';
import {
  SOCKETRELAY_DEFAULT_PAGE,
  SOCKETRELAY_DEFAULT_PAGE_SIZE,
  SOCKETRELAY_MAX_DETAILS_LENGTH,
  SOCKETRELAY_MAX_MESSAGE_LENGTH,
  SOCKETRELAY_MAX_PAGE_SIZE,
  SOCKETRELAY_MAX_TITLE_LENGTH,
} from './constants';
import type {
  SocketRelayAnnouncementInput,
  SocketRelayFulfillment,
  SocketRelayMessage,
  SocketRelayProfile,
  SocketRelayProfileInput,
  SocketRelayPublicRequest,
  SocketRelayRequest,
  SocketRelayRequestInput,
} from './types';
import { ensureSocketRelayFulfillmentChannel } from './stream';
import {
  archiveAnnouncement,
  createAnnouncementDraft,
  listAnnouncements,
  listFeedTimeline,
  publishAnnouncement,
  updateAnnouncementDraft,
} from 'lib/feed/repository';
import type { Announcement, AnnouncementDraftInput } from 'lib/shared/feed-primitives/types';

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
  city: string | null;
  is_public: boolean;
  status: 'open' | 'claimed' | 'closed' | 'cancelled';
  reopened_count: number;
  claimed_fulfillment_id: string | null;
  price_amount: string | number | null;
  price_currency: string | null;
  created_at: Date;
  updated_at: Date;
};

type FulfillmentRow = {
  id: string;
  request_id: string;
  requester_user_id: string;
  fulfiller_user_id: string;
  status: 'active' | 'closed' | 'cancelled';
  close_reason: string | null;
  created_at: Date;
  updated_at: Date;
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
    city: row.city,
    isPublic: row.is_public,
    status: row.status,
    reopenedCount: row.reopened_count,
    claimedFulfillmentId: row.claimed_fulfillment_id,
    priceCurrency: row.price_currency,
    priceAmount: row.price_amount === null || row.price_amount === undefined ? null : Number(row.price_amount),
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapPublicRequestRow(row: RequestRow): SocketRelayPublicRequest {
  return {
    id: row.id,
    ownerUsername: row.owner_username,
    title: row.title,
    category: row.category,
    city: row.city,
    status: row.status,
    createdAtIso: toIso(row.created_at),
  };
}

function mapFulfillmentRow(row: FulfillmentRow): SocketRelayFulfillment {
  return {
    id: row.id,
    requestId: row.request_id,
    requesterUserId: row.requester_user_id,
    fulfillerUserId: row.fulfiller_user_id,
    status: row.status,
    closeReason: row.close_reason,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
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

  return input.relayPreferences && typeof input.relayPreferences === 'object' && !Array.isArray(input.relayPreferences);
}

export function validateRequestInput(input: SocketRelayRequestInput): boolean {
  const title = normalizeText(input.title);
  const details = normalizeText(input.details);
  const category = normalizeText(input.category);

  if (title.length === 0 || title.length > SOCKETRELAY_MAX_TITLE_LENGTH) {
    return false;
  }

  if (details.length === 0 || details.length > SOCKETRELAY_MAX_DETAILS_LENGTH) {
    return false;
  }

  if (category.length === 0 || category.length > 64) {
    return false;
  }

  if (typeof input.isPublic !== 'boolean') {
    return false;
  }

  const city = normalizeNullableText(input.city);
  return !city || city.length <= 120;
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
  if (normalized.length === 0 || normalized.length > SOCKETRELAY_MAX_MESSAGE_LENGTH) {
    return false;
  }

  return !PROHIBITED_PATTERNS.some((pattern) => pattern.test(normalized));
}

function normalizePage(value: number | null | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return SOCKETRELAY_DEFAULT_PAGE;
  }

  return value;
}

function normalizePageSize(value: number | null | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return SOCKETRELAY_DEFAULT_PAGE_SIZE;
  }

  return Math.min(value, SOCKETRELAY_MAX_PAGE_SIZE);
}

export async function getProfile(userId: string): Promise<SocketRelayProfile | null> {
  const result = await queryDb<ProfileRow>(
    `SELECT user_id, bio, relay_preferences, presence_opt_in, service_deleted_at, updated_at
     FROM socketrelay_user_extension
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
    `INSERT INTO socketrelay_user_extension (
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
    `UPDATE socketrelay_user_extension
     SET service_deleted_at = NOW(), updated_at = NOW()
     WHERE user_id = $1`,
    [userId],
  );
}

export async function createRequest(actorUserId: string, actorUsername: string | null, input: SocketRelayRequestInput, idempotencyKey: string): Promise<SocketRelayRequest> {
  return withDbTransaction(async (client) => {
    const existing = await client.query<RequestRow>(
      `SELECT id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at
       FROM socketrelay_requests
       WHERE owner_user_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [actorUserId, idempotencyKey],
    );

    if ((existing.rowCount ?? 0) > 0) {
      return mapRequestRow(existing.rows[0]);
    }

    const created = await client.query<RequestRow>(
      `INSERT INTO socketrelay_requests (
         owner_user_id, owner_username, title, details, category, city, is_public, status, idempotency_key, price_amount, price_currency
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10)
       RETURNING id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at`,
      [
        actorUserId,
        normalizeNullableText(actorUsername),
        normalizeText(input.title),
        normalizeText(input.details),
        normalizeText(input.category),
        normalizeNullableText(input.city),
        input.isPublic,
        idempotencyKey,
        input.priceAmount,
        input.priceCurrency,
      ],
    );

    await client.query(
      `INSERT INTO socketrelay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_created', '{}'::jsonb)`,
      [created.rows[0].id, actorUserId],
    );

    return mapRequestRow(created.rows[0]);
  });
}

export async function listRequests(options?: {
  page?: number;
  pageSize?: number;
  ownerUserId?: string;
  isPublicOnly?: boolean;
}): Promise<{ items: SocketRelayRequest[]; page: number; pageSize: number; total: number }> {
  const page = normalizePage(options?.page);
  const pageSize = normalizePageSize(options?.pageSize);
  const offset = (page - 1) * pageSize;

  const ownerUserId = normalizeNullableText(options?.ownerUserId ?? null);
  const isPublicOnly = Boolean(options?.isPublicOnly);

  const count = await queryDb<CountRow>(
    `SELECT COUNT(*)::text AS total
     FROM socketrelay_requests
     WHERE ($1::text IS NULL OR owner_user_id = $1)
       AND ($2::boolean = FALSE OR is_public = TRUE)`,
    [ownerUserId, isPublicOnly],
  );

  const total = Number.parseInt(count.rows[0]?.total ?? '0', 10);

  const result = await queryDb<RequestRow>(
    `SELECT id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at
     FROM socketrelay_requests
     WHERE ($1::text IS NULL OR owner_user_id = $1)
       AND ($2::boolean = FALSE OR is_public = TRUE)
     ORDER BY created_at DESC
     OFFSET $3 LIMIT $4`,
    [ownerUserId, isPublicOnly, offset, pageSize],
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
    `SELECT id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at
     FROM socketrelay_requests
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
  const existing = await getRequestById(requestId);
  if (!existing) {
    throw new Error('request_not_found');
  }

  if (!isAdmin && existing.ownerUserId !== actorUserId) {
    throw new Error('not_owner');
  }

  const result = await queryDb<RequestRow>(
    `UPDATE socketrelay_requests
     SET title = $2,
         details = $3,
         category = $4,
         city = $5,
         is_public = $6,
         price_amount = $7,
         price_currency = $8,
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at`,
    [
      requestId,
      normalizeText(input.title),
      normalizeText(input.details),
      normalizeText(input.category),
      normalizeNullableText(input.city),
      input.isPublic,
      input.priceAmount,
      input.priceCurrency,
    ],
  );

  return mapRequestRow(result.rows[0]);
}

export async function repostRequest(requestId: string, actorUserId: string, isAdmin: boolean): Promise<SocketRelayRequest> {
  const existing = await getRequestById(requestId);
  if (!existing) {
    throw new Error('request_not_found');
  }

  if (!isAdmin && existing.ownerUserId !== actorUserId) {
    throw new Error('not_owner');
  }

  const result = await queryDb<RequestRow>(
    `UPDATE socketrelay_requests
     SET status = 'open',
         reopened_count = reopened_count + 1,
         claimed_fulfillment_id = NULL,
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at`,
    [requestId],
  );

  return mapRequestRow(result.rows[0]);
}

export async function claimRequest(requestId: string, actorUserId: string): Promise<{ request: SocketRelayRequest; fulfillment: SocketRelayFulfillment }> {
  const created = await withDbTransaction(async (client) => {
    const requestResult = await client.query<RequestRow>(
      `SELECT id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at
       FROM socketrelay_requests
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

    if (requestRow.status !== 'open') {
      throw new Error('request_not_claimable');
    }

    const fulfillment = await client.query<FulfillmentRow>(
      `INSERT INTO socketrelay_fulfillments (request_id, requester_user_id, fulfiller_user_id, status)
       VALUES ($1::uuid, $2, $3, 'active')
       RETURNING id, request_id, requester_user_id, fulfiller_user_id, status, close_reason, created_at, updated_at`,
      [requestId, requestRow.owner_user_id, actorUserId],
    );

    await client.query(
      `INSERT INTO socketrelay_fulfillment_participants (fulfillment_id, user_id, participant_role)
       VALUES ($1::uuid, $2, 'requester'), ($1::uuid, $3, 'fulfiller')
       ON CONFLICT (fulfillment_id, user_id) DO NOTHING`,
      [fulfillment.rows[0].id, requestRow.owner_user_id, actorUserId],
    );

    const requestUpdate = await client.query<RequestRow>(
      `UPDATE socketrelay_requests
       SET status = 'claimed', claimed_fulfillment_id = $2::uuid, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at`,
      [requestId, fulfillment.rows[0].id],
    );

    await client.query(
      `INSERT INTO socketrelay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_claimed', jsonb_build_object('fulfillmentId', $3::uuid))`,
      [requestId, actorUserId, fulfillment.rows[0].id],
    );

    return {
      request: mapRequestRow(requestUpdate.rows[0]),
      fulfillment: mapFulfillmentRow(fulfillment.rows[0]),
    };
  });

  await ensureSocketRelayFulfillmentChannel({
    fulfillmentId: created.fulfillment.id,
    requesterUserId: created.fulfillment.requesterUserId,
    requesterDisplayName: created.fulfillment.requesterUserId,
    fulfillerUserId: created.fulfillment.fulfillerUserId,
    fulfillerDisplayName: created.fulfillment.fulfillerUserId,
  });

  return created;
}

export async function getFulfillmentById(fulfillmentId: string): Promise<SocketRelayFulfillment | null> {
  const result = await queryDb<FulfillmentRow>(
    `SELECT id, request_id, requester_user_id, fulfiller_user_id, status, close_reason, created_at, updated_at
     FROM socketrelay_fulfillments
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
  const result = await queryDb<FulfillmentRow>(
    `SELECT id, request_id, requester_user_id, fulfiller_user_id, status, close_reason, created_at, updated_at
     FROM socketrelay_fulfillments
     WHERE requester_user_id = $1 OR fulfiller_user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows.map(mapFulfillmentRow);
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

export async function closeFulfillment(fulfillmentId: string, actorUserId: string, isAdmin: boolean, reason: string | null): Promise<SocketRelayFulfillment> {
  return withDbTransaction(async (client) => {
    const fulfillment = await ensureFulfillmentParticipant(fulfillmentId, actorUserId, isAdmin);

    const updated = await client.query<FulfillmentRow>(
      `UPDATE socketrelay_fulfillments
       SET status = 'closed', close_reason = $2, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, request_id, requester_user_id, fulfiller_user_id, status, close_reason, created_at, updated_at`,
      [fulfillmentId, normalizeNullableText(reason)],
    );

    await client.query(
      `UPDATE socketrelay_requests
       SET status = 'closed', updated_at = NOW()
       WHERE id = $1::uuid`,
      [fulfillment.requestId],
    );

    await client.query(
      `INSERT INTO socketrelay_request_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'fulfillment_closed', '{}'::jsonb)`,
      [fulfillment.requestId, actorUserId],
    );

    return mapFulfillmentRow(updated.rows[0]);
  });
}

export async function listFulfillmentMessages(fulfillmentId: string, actorUserId: string, isAdmin: boolean): Promise<SocketRelayMessage[]> {
  await ensureFulfillmentParticipant(fulfillmentId, actorUserId, isAdmin);

  const result = await queryDb<MessageRow>(
    `SELECT id, fulfillment_id, sender_user_id, message_text, moderation_status, created_at
     FROM socketrelay_messages
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
    `INSERT INTO socketrelay_messages (fulfillment_id, sender_user_id, message_text, client_message_id, moderation_status)
     VALUES ($1::uuid, $2, $3, $4, 'accepted')
     ON CONFLICT (fulfillment_id, sender_user_id, client_message_id)
     DO UPDATE SET message_text = EXCLUDED.message_text
     RETURNING id, fulfillment_id, sender_user_id, message_text, moderation_status, created_at`,
    [fulfillmentId, actorUserId, normalizeText(messageText), normalizeText(clientMessageId)],
  );

  return mapMessageRow(result.rows[0]);
}

export async function listPublicRequests(options?: { page?: number; pageSize?: number }): Promise<{ items: SocketRelayPublicRequest[]; page: number; pageSize: number; total: number }> {
  const page = normalizePage(options?.page);
  const pageSize = normalizePageSize(options?.pageSize);
  const offset = (page - 1) * pageSize;

  const count = await queryDb<CountRow>(
    `SELECT COUNT(*)::text AS total
     FROM socketrelay_requests
     WHERE is_public = TRUE AND status <> 'cancelled'`,
  );
  const total = Number.parseInt(count.rows[0]?.total ?? '0', 10);

  const result = await queryDb<RequestRow>(
    `SELECT id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at
     FROM socketrelay_requests
     WHERE is_public = TRUE AND status <> 'cancelled'
     ORDER BY created_at DESC
     OFFSET $1 LIMIT $2`,
    [offset, pageSize],
  );

  return {
    items: result.rows.map(mapPublicRequestRow),
    page,
    pageSize,
    total,
  };
}

export async function getPublicRequestById(requestId: string): Promise<SocketRelayPublicRequest | null> {
  const result = await queryDb<RequestRow>(
    `SELECT id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at
     FROM socketrelay_requests
     WHERE id = $1::uuid AND is_public = TRUE AND status <> 'cancelled'
     LIMIT 1`,
    [requestId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return mapPublicRequestRow(result.rows[0]);
}

export async function listAdminRequests(options?: { page?: number; pageSize?: number }) {
  return listRequests({ page: options?.page, pageSize: options?.pageSize });
}

export async function listAdminFulfillments(): Promise<SocketRelayFulfillment[]> {
  const result = await queryDb<FulfillmentRow>(
    `SELECT id, request_id, requester_user_id, fulfiller_user_id, status, close_reason, created_at, updated_at
     FROM socketrelay_fulfillments
     ORDER BY created_at DESC`,
  );

  return result.rows.map(mapFulfillmentRow);
}

export async function adminDeleteRequest(requestId: string): Promise<void> {
  const result = await queryDb<RequestRow>(
    `DELETE FROM socketrelay_requests
     WHERE id = $1::uuid
     RETURNING id, owner_user_id, owner_username, title, details, category, city, is_public, status, reopened_count, claimed_fulfillment_id, price_amount, price_currency, created_at, updated_at`,
    [requestId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('request_not_found');
  }
}

export async function listAnnouncementsForSocketRelayUser(input: {
  userId: string;
  role: string | null;
  page: number;
  pageSize: number;
}) {
  const timeline = await listFeedTimeline(
    input.userId,
    input.role,
    { page: normalizePage(input.page), pageSize: normalizePageSize(input.pageSize) },
    { pluginId: 'socketrelay' },
  );

  return {
    items: timeline.items.filter((item) => item.itemType === 'announcement'),
    pagination: timeline.pagination,
  };
}

export async function listSocketRelayAdminAnnouncements(): Promise<Announcement[]> {
  const items = await listAnnouncements(true);
  return items.filter((item) => {
    const plugins = item.targeting?.plugins;
    if (!plugins || plugins.length === 0) {
      return false;
    }

    return plugins.includes('socketrelay');
  });
}

export function validateAnnouncementInput(input: SocketRelayAnnouncementInput): boolean {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);

  if (title.length === 0 || title.length > 160) {
    return false;
  }

  if (body.length === 0 || body.length > 5000) {
    return false;
  }

  if (!Number.isInteger(input.priority) || input.priority < -10 || input.priority > 10) {
    return false;
  }

  return typeof input.mandatory === 'boolean' && typeof input.isActive === 'boolean';
}

export async function createSocketRelayAdminAnnouncement(actorUserId: string, input: SocketRelayAnnouncementInput): Promise<Announcement> {
  const draftInput: AnnouncementDraftInput = {
    title: normalizeText(input.title),
    body: normalizeText(input.body),
    mandatory: input.mandatory,
    priority: input.priority,
    expiresAtIso: input.expiresAtIso,
    targeting: { plugins: ['socketrelay'] },
  };

  const draft = await createAnnouncementDraft(actorUserId, draftInput);
  if (!input.isActive) {
    return draft;
  }

  return publishAnnouncement(actorUserId, draft.id);
}

export async function updateSocketRelayAdminAnnouncement(actorUserId: string, announcementId: string, input: SocketRelayAnnouncementInput): Promise<Announcement> {
  const draftInput: AnnouncementDraftInput = {
    title: normalizeText(input.title),
    body: normalizeText(input.body),
    mandatory: input.mandatory,
    priority: input.priority,
    expiresAtIso: input.expiresAtIso,
    targeting: { plugins: ['socketrelay'] },
  };

  const updated = await updateAnnouncementDraft(actorUserId, announcementId, draftInput);
  if (input.isActive) {
    return publishAnnouncement(actorUserId, updated.id);
  }

  return archiveAnnouncement(actorUserId, updated.id);
}

export async function deleteSocketRelayAdminAnnouncement(actorUserId: string, announcementId: string): Promise<Announcement> {
  return archiveAnnouncement(actorUserId, announcementId);
}

export async function insertSocketRelayAudit(input: AuditInput): Promise<void> {
  await queryDb(
    `INSERT INTO socketrelay_admin_audit_trail (
       actor_id,
       command,
       policy_status,
       reason,
       target_type,
       target_id,
       metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.actorId,
      input.command,
      input.policyStatus,
      input.reason,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
