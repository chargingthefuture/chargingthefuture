import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { getCurrency } from 'lib/currency/repository';
import { createTransfer } from 'lib/shared/credits-interface';
import { reportError } from 'lib/observability/report';
import {
  getAccountRestrictionStatus,
  restrictAccount as setSharedRestriction,
  unrestrictAccount as clearSharedRestriction,
} from 'lib/auth/account-restrictions';
import {
  TRUST_TRANSPORT_DEFAULT_PAGE,
  TRUST_TRANSPORT_DEFAULT_PAGE_SIZE,
  TRUST_TRANSPORT_MAX_DETAILS_LENGTH,
  TRUST_TRANSPORT_MAX_OFFER_NOTE_LENGTH,
  TRUST_TRANSPORT_MAX_PAGE_SIZE,
  TRUST_TRANSPORT_MAX_PROOF_LENGTH,
  TRUST_TRANSPORT_MAX_TITLE_LENGTH,
  TRUST_TRANSPORT_MODES,
} from './constants';
import type {
  TrustTransportIncident,
  TrustTransportMarketConfig,
  TrustTransportAvailableRequest,
  TrustTransportMode,
  TrustTransportOffer,
  TrustTransportOfferInput,
  TrustTransportProviderTrip,
  TrustTransportRequest,
  TrustTransportRequestInput,
  TrustTransportTrip,
  TrustTransportTripStatus,
} from './types';
import { ensureTrustTransportTripChannel } from './stream';
import { clearMemberPresence, recordMemberPresence } from 'lib/presence/live';

// Cross-plugin presence: a TrustTransport ride request marks its requester (the rider) as active.
// A request counts as active presence unless its status is terminal, so the live hooks clear presence
// only when the request reaches one of those terminal states.
const TRUST_TRANSPORT_PRESENCE_SLUG = 'trust-transport';
const TRUST_TRANSPORT_REQUEST_REF_TYPE = 'request';
const TRUST_TRANSPORT_REQUEST_LABEL = 'Ride request';
const TRUST_TRANSPORT_PRESENCE_DEEP_LINK = '/apps/trust-transport';

// Statuses that mean a request is no longer active presence — mirrors the backfill's terminal set.
const TRUST_TRANSPORT_TERMINAL_STATUSES = new Set([
  'canceled',
  'canceled',
  'completed',
  'closed',
  'withdrawn',
  'declined',
  'expired',
  'rejected',
]);

function isTrustTransportRequestActive(status: string | null | undefined): boolean {
  return !TRUST_TRANSPORT_TERMINAL_STATUSES.has((status ?? '').toLowerCase());
}

// Keep the requester's TrustTransport presence in step with a request's current status. Best-effort:
// swallows its own failure and never breaks the caller's request operation.
async function syncTrustTransportRequestPresence(
  requesterUserId: string,
  requestId: string,
  status: string | null | undefined,
): Promise<void> {
  if (isTrustTransportRequestActive(status)) {
    await recordMemberPresence({
      userId: requesterUserId,
      pluginSlug: TRUST_TRANSPORT_PRESENCE_SLUG,
      refType: TRUST_TRANSPORT_REQUEST_REF_TYPE,
      refId: requestId,
      label: TRUST_TRANSPORT_REQUEST_LABEL,
      deepLink: TRUST_TRANSPORT_PRESENCE_DEEP_LINK,
    });
  } else {
    await clearMemberPresence({
      userId: requesterUserId,
      pluginSlug: TRUST_TRANSPORT_PRESENCE_SLUG,
      refType: TRUST_TRANSPORT_REQUEST_REF_TYPE,
      refId: requestId,
    });
  }
}

type CountRow = { total: string };

type RequestRow = {
  id: string;
  requester_user_id: string;
  mode: TrustTransportMode;
  title: string;
  details: string;
  pickup_city: string | null;
  dropoff_city: string | null;
  pickup_geo_redacted: string | null;
  dropoff_geo_redacted: string | null;
  status: TrustTransportRequest['status'];
  price_amount: string | number | null;
  price_currency: string | null;
  created_at: Date;
  updated_at: Date;
  // Present only when the row is selected with a join to trust_transport_trips (e.g. listRequests).
  trip_id?: string | null;
  trip_status?: TrustTransportTripStatus | null;
  requester_completion_confirmed_at?: Date | null;
  provider_completion_confirmed_at?: Date | null;
};

type OfferRow = {
  id: string;
  request_id: string;
  provider_user_id: string;
  note: string | null;
  proposed_amount: string | null;
  status: TrustTransportOffer['status'];
  created_at: Date;
  updated_at: Date;
};

type TripRow = {
  id: string;
  request_id: string;
  offer_id: string;
  requester_user_id: string;
  provider_user_id: string;
  mode: TrustTransportMode;
  status: TrustTransportTrip['status'];
  stream_channel_id: string | null;
  canceled_reason: string | null;
  completed_at: Date | null;
  requester_completion_confirmed_at: Date | null;
  provider_completion_confirmed_at: Date | null;
  created_at: Date;
  updated_at: Date;
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

const REQUEST_TRANSITIONS: Record<TrustTransportRequest['status'], TrustTransportRequest['status'][]> = {
  open: ['accepted', 'canceled', 'emergency_frozen'],
  accepted: ['in_progress', 'canceled', 'disputed', 'emergency_frozen'],
  in_progress: ['completed', 'canceled', 'disputed', 'emergency_frozen'],
  completed: [],
  canceled: [],
  disputed: ['completed', 'canceled'],
  emergency_frozen: ['disputed', 'canceled'],
};

const TRIP_TRANSITIONS: Record<TrustTransportTrip['status'], TrustTransportTripStatus[]> = {
  assigned: ['en_route', 'canceled', 'disputed', 'emergency_frozen'],
  en_route: ['picked_up', 'canceled', 'disputed', 'emergency_frozen'],
  picked_up: ['delivered', 'canceled', 'disputed', 'emergency_frozen'],
  delivered: ['completed', 'disputed', 'emergency_frozen'],
  completed: [],
  canceled: [],
  disputed: ['completed', 'canceled'],
  emergency_frozen: ['disputed', 'canceled'],
};

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

function normalizePage(value: number | null | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return TRUST_TRANSPORT_DEFAULT_PAGE;
  }

  return value;
}

function normalizePageSize(value: number | null | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return TRUST_TRANSPORT_DEFAULT_PAGE_SIZE;
  }

  return Math.min(value, TRUST_TRANSPORT_MAX_PAGE_SIZE);
}

function isMode(value: string): value is TrustTransportMode {
  return (TRUST_TRANSPORT_MODES as readonly string[]).includes(value);
}

function mapRequestRow(row: RequestRow): TrustTransportRequest {
  return {
    id: row.id,
    requesterUserId: row.requester_user_id,
    mode: row.mode,
    title: row.title,
    details: row.details,
    pickupCity: row.pickup_city,
    dropoffCity: row.dropoff_city,
    pickupGeoRedacted: row.pickup_geo_redacted,
    dropoffGeoRedacted: row.dropoff_geo_redacted,
    status: row.status,
    priceCurrency: row.price_currency,
    priceAmount: row.price_amount === null || row.price_amount === undefined ? null : Number(row.price_amount),
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
    tripId: row.trip_id ?? null,
    tripStatus: row.trip_status ?? null,
    requesterCompletionConfirmedAtIso: row.requester_completion_confirmed_at ? toIso(row.requester_completion_confirmed_at) : null,
    providerCompletionConfirmedAtIso: row.provider_completion_confirmed_at ? toIso(row.provider_completion_confirmed_at) : null,
  };
}

function mapOfferRow(row: OfferRow): TrustTransportOffer {
  return {
    id: row.id,
    requestId: row.request_id,
    providerUserId: row.provider_user_id,
    note: row.note,
    proposedAmount: row.proposed_amount ? Number.parseFloat(row.proposed_amount) : null,
    status: row.status,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapTripRow(row: TripRow): TrustTransportTrip {
  return {
    id: row.id,
    requestId: row.request_id,
    offerId: row.offer_id,
    requesterUserId: row.requester_user_id,
    providerUserId: row.provider_user_id,
    mode: row.mode,
    status: row.status,
    streamChannelId: row.stream_channel_id,
    canceledReason: row.canceled_reason,
    completedAtIso: row.completed_at ? toIso(row.completed_at) : null,
    requesterCompletionConfirmedAtIso: row.requester_completion_confirmed_at ? toIso(row.requester_completion_confirmed_at) : null,
    providerCompletionConfirmedAtIso: row.provider_completion_confirmed_at ? toIso(row.provider_completion_confirmed_at) : null,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

export function validateRequestInput(input: TrustTransportRequestInput): boolean {
  if (!isMode(input.mode)) {
    return false;
  }

  const title = normalizeText(input.title);
  const details = normalizeText(input.details);

  if (title.length === 0 || title.length > TRUST_TRANSPORT_MAX_TITLE_LENGTH) {
    return false;
  }

  if (details.length === 0 || details.length > TRUST_TRANSPORT_MAX_DETAILS_LENGTH) {
    return false;
  }

  return true;
}

// Validate the chosen settlement value type + amount against the currency catalog (issue #420). No value
// type (both null) is allowed. Otherwise the code must be an active currency, with a positive amount for
// priced types (requires_amount) and no amount for amount-less types (Free, Barter).
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

export function validateTripProof(artifactType: string, artifactRedacted: string): boolean {
  if (!['photo', 'code', 'note'].includes(artifactType)) {
    return false;
  }

  const normalized = normalizeText(artifactRedacted);
  return normalized.length > 0 && normalized.length <= TRUST_TRANSPORT_MAX_PROOF_LENGTH;
}

async function ensureUserNotRestricted(userId: string): Promise<void> {
  // Reads the platform-wide restriction signal ('trading' scope), not the retired per-plugin column.
  const restriction = await getAccountRestrictionStatus(userId, 'trading');
  if (restriction.isRestricted) {
    throw new Error('account_restricted');
  }
}

export async function listModes() {
  return TRUST_TRANSPORT_MODES;
}

export async function createRequest(
  actorUserId: string,
  input: TrustTransportRequestInput,
  idempotencyKey: string,
): Promise<TrustTransportRequest> {
  if (!validateRequestInput(input)) {
    throw new Error('invalid_payload');
  }

  if (!(await isValidRequestPrice(input.priceCurrency, input.priceAmount))) {
    throw new Error('invalid_request_price');
  }

  await ensureUserNotRestricted(actorUserId);

  const request = await withDbTransaction(async (client) => {
    const existing = await client.query<RequestRow>(
      `SELECT id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at
       FROM trust_transport_requests
       WHERE requester_user_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [actorUserId, idempotencyKey],
    );

    if ((existing.rowCount ?? 0) > 0) {
      return mapRequestRow(existing.rows[0]);
    }

    const created = await client.query<RequestRow>(
      `INSERT INTO trust_transport_requests (
         requester_user_id,
         mode,
         title,
         details,
         pickup_city,
         dropoff_city,
         pickup_geo_redacted,
         dropoff_geo_redacted,
         status,
         idempotency_key,
         price_amount,
         price_currency
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, $11)
       RETURNING id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at`,
      [
        actorUserId,
        input.mode,
        normalizeText(input.title),
        normalizeText(input.details),
        normalizeNullableText(input.pickupCity),
        normalizeNullableText(input.dropoffCity),
        normalizeNullableText(input.pickupGeoRedacted),
        normalizeNullableText(input.dropoffGeoRedacted),
        normalizeText(idempotencyKey),
        input.priceAmount,
        input.priceCurrency,
      ],
    );

    await client.query(
      `INSERT INTO trust_transport_status_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_created', '{}'::jsonb)`,
      [created.rows[0].id, actorUserId],
    );

    return mapRequestRow(created.rows[0]);
  });

  // Best-effort presence write after the request is durably committed: a new open request makes the
  // rider active in TrustTransport. Never breaks request creation.
  await syncTrustTransportRequestPresence(request.requesterUserId, request.id, request.status);

  return request;
}

export async function getRequestById(requestId: string): Promise<TrustTransportRequest | null> {
  const result = await queryDb<RequestRow>(
    `SELECT id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at
     FROM trust_transport_requests
     WHERE id = $1::uuid
     LIMIT 1`,
    [requestId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return mapRequestRow(result.rows[0]);
}

export async function listRequests(options?: { page?: number; pageSize?: number; requesterUserId?: string }) {
  const page = normalizePage(options?.page);
  const pageSize = normalizePageSize(options?.pageSize);
  const offset = (page - 1) * pageSize;
  const requesterUserId = normalizeNullableText(options?.requesterUserId ?? null);

  const count = await queryDb<CountRow>(
    `SELECT COUNT(*)::text AS total
     FROM trust_transport_requests
     WHERE ($1::text IS NULL OR requester_user_id = $1)`,
    [requesterUserId],
  );
  const total = Number.parseInt(count.rows[0]?.total ?? '0', 10);

  const result = await queryDb<RequestRow>(
    // LATERAL with LIMIT 1 so a request with more than one trip row (data anomaly) cannot duplicate the
    // request in the page and diverge from the COUNT above — at most one trip id per request.
    `SELECT r.id, r.requester_user_id, r.mode, r.title, r.details, r.pickup_city, r.dropoff_city, r.pickup_geo_redacted, r.dropoff_geo_redacted, r.status, r.price_amount, r.price_currency, r.created_at, r.updated_at,
            t.id AS trip_id, t.status AS trip_status, t.requester_completion_confirmed_at, t.provider_completion_confirmed_at
     FROM trust_transport_requests r
     LEFT JOIN LATERAL (
       SELECT id, status, requester_completion_confirmed_at, provider_completion_confirmed_at FROM trust_transport_trips
       WHERE request_id = r.id
       ORDER BY created_at
       LIMIT 1
     ) t ON TRUE
     WHERE ($1::text IS NULL OR r.requester_user_id = $1)
     ORDER BY r.created_at DESC
     OFFSET $2 LIMIT $3`,
    [requesterUserId, offset, pageSize],
  );

  return {
    items: result.rows.map(mapRequestRow),
    page,
    pageSize,
    total,
  };
}

export async function listOffersForRequest(requestId: string): Promise<TrustTransportOffer[]> {
  const result = await queryDb<OfferRow>(
    `SELECT id, request_id, provider_user_id, note, proposed_amount, status, created_at, updated_at
     FROM trust_transport_offers
     WHERE request_id = $1::uuid
     ORDER BY created_at ASC`,
    [requestId],
  );

  return result.rows.map(mapOfferRow);
}

// Discovery for members who want to help (model B). Lists OPEN requests the caller does not own, but
// returns only mode + settlement + age — never the pickup/drop-off text or the title (which embeds the
// locations). A provider learns the location only after the requester accepts their offer (the trip
// then carries the full request). This protects a survivor's whereabouts from open browsing.
export async function listAvailableRequests(options: {
  excludeUserId: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: TrustTransportAvailableRequest[]; page: number; pageSize: number; total: number }> {
  const page = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);
  const offset = (page - 1) * pageSize;
  const excludeUserId = options.excludeUserId;

  const count = await queryDb<CountRow>(
    `SELECT COUNT(*)::text AS total
     FROM trust_transport_requests
     WHERE status = 'open' AND requester_user_id <> $1`,
    [excludeUserId],
  );
  const total = Number.parseInt(count.rows[0]?.total ?? '0', 10);

  const result = await queryDb<{
    id: string;
    mode: TrustTransportMode;
    price_amount: string | number | null;
    price_currency: string | null;
    created_at: Date;
  }>(
    `SELECT id, mode, price_amount, price_currency, created_at
     FROM trust_transport_requests
     WHERE status = 'open' AND requester_user_id <> $1
     ORDER BY created_at DESC
     OFFSET $2 LIMIT $3`,
    [excludeUserId, offset, pageSize],
  );

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      mode: row.mode,
      priceCurrency: row.price_currency,
      priceAmount: row.price_amount === null || row.price_amount === undefined ? null : Number(row.price_amount),
      createdAtIso: toIso(row.created_at),
    })),
    page,
    pageSize,
    total,
  };
}

export function validateOfferInput(input: TrustTransportOfferInput): boolean {
  const note = normalizeNullableText(input.note);
  if (note && note.length > TRUST_TRANSPORT_MAX_OFFER_NOTE_LENGTH) {
    return false;
  }

  if (input.proposedAmount !== null) {
    if (!Number.isInteger(input.proposedAmount) || input.proposedAmount <= 0) {
      return false;
    }
  }

  return true;
}

// A provider offers to fulfill an open request. One offer per provider per request: re-offering updates
// the existing row (note/amount) and keeps it pending, rather than stacking duplicate offers.
export async function createOffer(
  requestId: string,
  providerUserId: string,
  input: TrustTransportOfferInput,
): Promise<TrustTransportOffer> {
  if (!validateOfferInput(input)) {
    throw new Error('invalid_payload');
  }

  await ensureUserNotRestricted(providerUserId);

  const request = await getRequestById(requestId);
  if (!request) {
    throw new Error('request_not_found');
  }

  // You cannot make an offer on your own request, and you can only offer while it is still open.
  if (request.requesterUserId === providerUserId) {
    throw new Error('policy_denied');
  }

  if (request.status !== 'open') {
    throw new Error('invalid_transition');
  }

  const note = normalizeNullableText(input.note);

  return withDbTransaction(async (client) => {
    const existing = await client.query<OfferRow>(
      `SELECT id, request_id, provider_user_id, note, proposed_amount, status, created_at, updated_at
       FROM trust_transport_offers
       WHERE request_id = $1::uuid AND provider_user_id = $2
       LIMIT 1
       FOR UPDATE`,
      [requestId, providerUserId],
    );

    if ((existing.rowCount ?? 0) > 0) {
      const updated = await client.query<OfferRow>(
        `UPDATE trust_transport_offers
         SET note = $2, proposed_amount = $3, status = 'pending', updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING id, request_id, provider_user_id, note, proposed_amount, status, created_at, updated_at`,
        [existing.rows[0].id, note, input.proposedAmount],
      );

      return mapOfferRow(updated.rows[0]);
    }

    const created = await client.query<OfferRow>(
      `INSERT INTO trust_transport_offers (request_id, provider_user_id, note, proposed_amount, status)
       VALUES ($1::uuid, $2, $3, $4, 'pending')
       RETURNING id, request_id, provider_user_id, note, proposed_amount, status, created_at, updated_at`,
      [requestId, providerUserId, note, input.proposedAmount],
    );

    return mapOfferRow(created.rows[0]);
  });
}

export async function acceptOffer(requestId: string, offerId: string, actorUserId: string, idempotencyKey: string): Promise<{ trip: TrustTransportTrip; request: TrustTransportRequest }> {
  const request = await getRequestById(requestId);
  if (!request) {
    throw new Error('request_not_found');
  }

  if (request.requesterUserId !== actorUserId) {
    throw new Error('policy_denied');
  }

  if (request.status !== 'open') {
    throw new Error('invalid_transition');
  }

  const created = await withDbTransaction(async (client) => {
    const offerResult = await client.query<OfferRow>(
      `SELECT id, request_id, provider_user_id, note, proposed_amount, status, created_at, updated_at
       FROM trust_transport_offers
       WHERE id = $1::uuid AND request_id = $2::uuid
       LIMIT 1
       FOR UPDATE`,
      [offerId, requestId],
    );

    if ((offerResult.rowCount ?? 0) === 0) {
      throw new Error('offer_not_found');
    }

    const offer = offerResult.rows[0];

    const existingTrip = await client.query<TripRow>(
      `SELECT id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, canceled_reason, completed_at, requester_completion_confirmed_at, provider_completion_confirmed_at, created_at, updated_at
       FROM trust_transport_trips
       WHERE request_id = $1::uuid
       LIMIT 1`,
      [requestId],
    );

    if ((existingTrip.rowCount ?? 0) > 0) {
      const requestUpdate = await client.query<RequestRow>(
        `SELECT id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at
         FROM trust_transport_requests
         WHERE id = $1::uuid
         LIMIT 1`,
        [requestId],
      );

      return {
        trip: mapTripRow(existingTrip.rows[0]),
        request: mapRequestRow(requestUpdate.rows[0]),
      };
    }

    await client.query(
      `UPDATE trust_transport_offers
       SET status = CASE WHEN id = $1::uuid THEN 'accepted' ELSE 'rejected' END,
           updated_at = NOW()
       WHERE request_id = $2::uuid`,
      [offerId, requestId],
    );

    const tripResult = await client.query<TripRow>(
      `INSERT INTO trust_transport_trips (request_id, offer_id, requester_user_id, provider_user_id, mode, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'assigned')
       RETURNING id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, canceled_reason, completed_at, requester_completion_confirmed_at, provider_completion_confirmed_at, created_at, updated_at`,
      [requestId, offerId, request.requesterUserId, offer.provider_user_id, request.mode],
    );

    const requestResult = await client.query<RequestRow>(
      `UPDATE trust_transport_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at`,
      [requestId],
    );

    await client.query(
      `INSERT INTO trust_transport_status_events (request_id, trip_id, actor_user_id, event_name, from_status, to_status, metadata)
       VALUES ($1::uuid, $2::uuid, $3, 'offer_accepted', 'open', 'accepted', jsonb_build_object('offerId', $4::uuid, 'idempotencyKey', $5))`,
      [requestId, tripResult.rows[0].id, actorUserId, offerId, idempotencyKey],
    );

    return {
      trip: mapTripRow(tripResult.rows[0]),
      request: mapRequestRow(requestResult.rows[0]),
    };
  });

  const streamChannelId = await ensureTrustTransportTripChannel({
    tripId: created.trip.id,
    requesterUserId: created.trip.requesterUserId,
    providerUserId: created.trip.providerUserId,
  });

  if (streamChannelId) {
    await queryDb(
      `UPDATE trust_transport_trips
       SET stream_channel_id = $2, updated_at = NOW()
       WHERE id = $1::uuid`,
      [created.trip.id, streamChannelId],
    );

    created.trip.streamChannelId = streamChannelId;
  }

  return created;
}

// Trips the caller is fulfilling (provider side), with the now-revealed request location. Powers the
// provider's "trips you're helping with" surface so they can advance the lifecycle.
export async function listProviderTrips(providerUserId: string): Promise<TrustTransportProviderTrip[]> {
  const result = await queryDb<{
    trip_id: string;
    request_id: string;
    status: TrustTransportTrip['status'];
    mode: TrustTransportMode;
    pickup_city: string | null;
    dropoff_city: string | null;
    price_amount: string | number | null;
    price_currency: string | null;
    requester_completion_confirmed_at: Date | null;
    provider_completion_confirmed_at: Date | null;
    trip_created_at: Date;
  }>(
    `SELECT t.id AS trip_id, t.request_id, t.status, t.mode,
            r.pickup_city, r.dropoff_city, r.price_amount, r.price_currency,
            t.requester_completion_confirmed_at, t.provider_completion_confirmed_at, t.created_at AS trip_created_at
     FROM trust_transport_trips t
     JOIN trust_transport_requests r ON r.id = t.request_id
     WHERE t.provider_user_id = $1
     ORDER BY t.created_at DESC`,
    [providerUserId],
  );

  return result.rows.map((row) => ({
    tripId: row.trip_id,
    requestId: row.request_id,
    status: row.status,
    mode: row.mode,
    pickupCity: row.pickup_city,
    dropoffCity: row.dropoff_city,
    priceCurrency: row.price_currency,
    priceAmount: row.price_amount === null || row.price_amount === undefined ? null : Number(row.price_amount),
    requesterCompletionConfirmedAtIso: row.requester_completion_confirmed_at ? toIso(row.requester_completion_confirmed_at) : null,
    providerCompletionConfirmedAtIso: row.provider_completion_confirmed_at ? toIso(row.provider_completion_confirmed_at) : null,
    createdAtIso: toIso(row.trip_created_at),
  }));
}

export async function getTripById(tripId: string): Promise<TrustTransportTrip | null> {
  const result = await queryDb<TripRow>(
    `SELECT id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, canceled_reason, completed_at, requester_completion_confirmed_at, provider_completion_confirmed_at, created_at, updated_at
     FROM trust_transport_trips
     WHERE id = $1::uuid
     LIMIT 1`,
    [tripId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return mapTripRow(result.rows[0]);
}

function assertTripTransition(currentStatus: TrustTransportTrip['status'], nextStatus: TrustTransportTripStatus): void {
  const allowed = TRIP_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error('invalid_transition');
  }
}

// A trip's status may be changed only by one of its two participants (requester or provider) or an admin.
function assertTripActorAllowed(trip: TripRow, actorUserId: string, isAdmin: boolean): void {
  const isParticipant = trip.requester_user_id === actorUserId || trip.provider_user_id === actorUserId;
  if (!isParticipant && !isAdmin) {
    throw new Error('policy_denied');
  }
}

function mapRequestStatusFromTrip(nextStatus: TrustTransportTripStatus): TrustTransportRequest['status'] {
  if (nextStatus === 'assigned' || nextStatus === 'en_route' || nextStatus === 'picked_up') {
    return 'in_progress';
  }

  if (nextStatus === 'delivered' || nextStatus === 'completed') {
    return 'completed';
  }

  if (nextStatus === 'canceled') {
    return 'canceled';
  }

  if (nextStatus === 'disputed') {
    return 'disputed';
  }

  return 'emergency_frozen';
}

export async function updateTripStatus(
  tripId: string,
  actorUserId: string,
  isAdmin: boolean,
  nextStatus: TrustTransportTripStatus,
  note: string | null,
): Promise<{ trip: TrustTransportTrip; request: TrustTransportRequest }> {
  const result = await withDbTransaction(async (client) => {
    const tripResult = await client.query<TripRow>(
      `SELECT id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, canceled_reason, completed_at, requester_completion_confirmed_at, provider_completion_confirmed_at, created_at, updated_at
       FROM trust_transport_trips
       WHERE id = $1::uuid
       LIMIT 1
       FOR UPDATE`,
      [tripId],
    );

    if ((tripResult.rowCount ?? 0) === 0) {
      throw new Error('trip_not_found');
    }

    const trip = tripResult.rows[0];
    assertTripActorAllowed(trip, actorUserId, isAdmin);

    // Neither party can unilaterally complete a trip (owner decision, 2026-07-08): completion is what
    // triggers settlement (a ServiceCredits debit from the requester, or an earnings-ledger credit for an
    // off-platform fiat/crypto exchange the platform never verified), so it must go through
    // confirmTripCompletion() below, which requires both the requester and the provider to confirm.
    // Admins keep a direct override (e.g. resolving a dispute in the requester's or provider's favor).
    if (nextStatus === 'completed' && !isAdmin) {
      throw new Error('completion_requires_confirmation');
    }

    assertTripTransition(trip.status, nextStatus);

    const nextRequestStatus = mapRequestStatusFromTrip(nextStatus);

    // Guard against an unmapped request status. The previous `|| REQUEST_TRANSITIONS.open` fallback was
    // always truthy, so the check could never fire; drop it so a missing key is actually caught.
    if (!REQUEST_TRANSITIONS[nextRequestStatus]) {
      throw new Error('invalid_transition');
    }

    const updatedTripResult = await client.query<TripRow>(
      `UPDATE trust_transport_trips
       SET status = $2,
           canceled_reason = CASE WHEN $2 = 'canceled' THEN $3 ELSE canceled_reason END,
           completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, canceled_reason, completed_at, requester_completion_confirmed_at, provider_completion_confirmed_at, created_at, updated_at`,
      [tripId, nextStatus, normalizeNullableText(note)],
    );

    const updatedRequestResult = await client.query<RequestRow>(
      `UPDATE trust_transport_requests
       SET status = $2, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at`,
      [trip.request_id, nextRequestStatus],
    );

    await client.query(
      `INSERT INTO trust_transport_status_events (request_id, trip_id, actor_user_id, event_name, from_status, to_status, metadata)
       VALUES ($1::uuid, $2::uuid, $3, 'trip_status_updated', $4, $5, jsonb_build_object('note', $6))`,
      [trip.request_id, trip.id, actorUserId, trip.status, nextStatus, normalizeNullableText(note)],
    );

    if (nextStatus === 'disputed') {
      await client.query(
        `INSERT INTO trust_transport_disputes (trip_id, request_id, opened_by_user_id, reason, status)
         VALUES ($1::uuid, $2::uuid, $3, $4, 'open')`,
        [trip.id, trip.request_id, actorUserId, normalizeNullableText(note) ?? 'status_dispute'],
      );
    }

    return {
      trip: mapTripRow(updatedTripResult.rows[0]),
      request: mapRequestRow(updatedRequestResult.rows[0]),
    };
  });

  // Best-effort presence sync after the status change is durably committed: a trip moving the request
  // to a terminal status (completed/canceled) clears the rider's presence; otherwise it stays active.
  // Never breaks the status update.
  await syncTrustTransportRequestPresence(
    result.request.requesterUserId,
    result.request.id,
    result.request.status,
  );

  // Settlement (owner decision): when a trip completes, ServiceCredits move requester -> provider, and
  // fiat/crypto settlement credits the provider's earnings ledger. Runs after the completion is committed.
  await settleTripOnCompletion(result.trip, result.request, nextStatus);

  return result;
}

// Record one participant's completion confirmation. Only confirmable from "delivered". Idempotent per
// participant (re-confirming does not move the timestamp). Once both the requester and the provider have
// confirmed, the trip actually transitions to "completed" and settlement fires — this is the only path to
// "completed" for a non-admin (see the gate in updateTripStatus above). Returns `bothConfirmed` so the
// caller can distinguish "recorded your confirmation, still waiting on the other party" from "trip is now
// fully completed."
export async function confirmTripCompletion(
  tripId: string,
  actorUserId: string,
): Promise<{ trip: TrustTransportTrip; request: TrustTransportRequest; bothConfirmed: boolean }> {
  const result = await withDbTransaction(async (client) => {
    const tripResult = await client.query<TripRow>(
      `SELECT id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, canceled_reason, completed_at, requester_completion_confirmed_at, provider_completion_confirmed_at, created_at, updated_at
       FROM trust_transport_trips
       WHERE id = $1::uuid
       LIMIT 1
       FOR UPDATE`,
      [tripId],
    );

    if ((tripResult.rowCount ?? 0) === 0) {
      throw new Error('trip_not_found');
    }

    const trip = tripResult.rows[0];
    const isRequester = trip.requester_user_id === actorUserId;
    const isProvider = trip.provider_user_id === actorUserId;
    if (!isRequester && !isProvider) {
      throw new Error('policy_denied');
    }

    if (trip.status !== 'delivered') {
      throw new Error('invalid_transition');
    }

    const column = isRequester ? 'requester_completion_confirmed_at' : 'provider_completion_confirmed_at';
    const confirmedResult = await client.query<TripRow>(
      `UPDATE trust_transport_trips
       SET ${column} = COALESCE(${column}, NOW()), updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, canceled_reason, completed_at, requester_completion_confirmed_at, provider_completion_confirmed_at, created_at, updated_at`,
      [tripId],
    );

    await client.query(
      `INSERT INTO trust_transport_status_events (request_id, trip_id, actor_user_id, event_name, from_status, to_status, metadata)
       VALUES ($1::uuid, $2::uuid, $3, 'trip_completion_confirmed', 'delivered', 'delivered', jsonb_build_object('role', $4))`,
      [trip.request_id, trip.id, actorUserId, isRequester ? 'requester' : 'provider'],
    );

    let confirmedTrip = confirmedResult.rows[0];
    const bothConfirmed = confirmedTrip.requester_completion_confirmed_at !== null && confirmedTrip.provider_completion_confirmed_at !== null;

    let requestRow: RequestRow;
    if (bothConfirmed) {
      const completedTripResult = await client.query<TripRow>(
        `UPDATE trust_transport_trips
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, canceled_reason, completed_at, requester_completion_confirmed_at, provider_completion_confirmed_at, created_at, updated_at`,
        [tripId],
      );
      confirmedTrip = completedTripResult.rows[0];

      const completedRequestResult = await client.query<RequestRow>(
        `UPDATE trust_transport_requests
         SET status = 'completed', updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at`,
        [trip.request_id],
      );
      requestRow = completedRequestResult.rows[0];

      await client.query(
        `INSERT INTO trust_transport_status_events (request_id, trip_id, actor_user_id, event_name, from_status, to_status, metadata)
         VALUES ($1::uuid, $2::uuid, $3, 'trip_status_updated', 'delivered', 'completed', jsonb_build_object('reason', 'mutual_completion_confirmed'))`,
        [trip.request_id, trip.id, actorUserId],
      );
    } else {
      const requestResult = await client.query<RequestRow>(
        `SELECT id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at
         FROM trust_transport_requests
         WHERE id = $1::uuid
         LIMIT 1`,
        [trip.request_id],
      );
      requestRow = requestResult.rows[0];
    }

    return {
      trip: mapTripRow(confirmedTrip),
      request: mapRequestRow(requestRow),
      bothConfirmed,
    };
  });

  if (result.bothConfirmed) {
    await syncTrustTransportRequestPresence(
      result.request.requesterUserId,
      result.request.id,
      result.request.status,
    );
    await settleTripOnCompletion(result.trip, result.request, 'completed');
  }

  return result;
}

// ServiceCredits rail: move credits from the requester's wallet to the provider's, idempotent by trip id,
// then record the settlement in the admin audit trail.
async function settleTripViaServiceCredits(
  trip: TrustTransportTrip,
  request: TrustTransportRequest,
  currency: string,
  amount: number,
): Promise<void> {
  const tx = await createTransfer({
    senderUserId: request.requesterUserId,
    recipientUserId: trip.providerUserId,
    amount,
    idempotencyKey: `trust-transport-settlement-${trip.id}`,
    originPlugin: 'trust-transport',
    reasonCode: 'trust-transport.trip.settlement',
  });

  await insertTrustTransportAudit({
    actorId: trip.providerUserId,
    command: 'trust-transport.trip.settlement',
    policyStatus: 'allow',
    reason: 'ok',
    targetType: 'trip',
    targetId: trip.id,
    metadata: {
      rail: 'service_credits',
      currency,
      amount,
      fromUserId: request.requesterUserId,
      toUserId: trip.providerUserId,
      transferId: (tx as { id?: string }).id ?? null,
    },
  });
}

// Fiat/crypto rail: credit the provider's earnings ledger in the settlement currency, idempotent by trip id
// so a re-completion cannot double-credit. Payouts draw from this per-currency balance. Only audits when a
// new ledger row is actually inserted.
async function settleTripViaEarningsLedger(
  trip: TrustTransportTrip,
  currency: string,
  amount: number,
): Promise<void> {
  const credited = await queryDb(
    `INSERT INTO trust_transport_earnings_ledger (provider_user_id, trip_id, entry_type, amount, currency, price_currency, status, metadata)
     SELECT $1, $2::uuid, 'credit', $3, $4, $4, 'posted', jsonb_build_object('reason', 'trip_settlement')
     WHERE NOT EXISTS (
       SELECT 1 FROM trust_transport_earnings_ledger
       WHERE trip_id = $2::uuid AND entry_type = 'credit' AND (metadata->>'reason') = 'trip_settlement'
     )`,
    [trip.providerUserId, trip.id, amount, currency],
  );

  if ((credited.rowCount ?? 0) > 0) {
    await insertTrustTransportAudit({
      actorId: trip.providerUserId,
      command: 'trust-transport.trip.settlement',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'trip',
      targetId: trip.id,
      metadata: { rail: 'earnings_ledger', currency, amount, toUserId: trip.providerUserId },
    });
  }
}

// Settle a completed trip against the requester's chosen settlement. Best-effort and idempotent by trip
// id: the trip is already completed and the work done, so a failure here (e.g. the requester lacks
// balance) is logged for reconciliation rather than reverting the trip, and the trip-id key means a
// retry can never double-pay. ServiceCredits move to the provider's wallet; fiat/crypto accrue to the
// provider's earnings ledger in that currency (payout-able); Free/Barter move nothing.
async function settleTripOnCompletion(
  trip: TrustTransportTrip,
  request: TrustTransportRequest,
  nextStatus: TrustTransportTripStatus,
): Promise<void> {
  if (nextStatus !== 'completed') {
    return;
  }
  const currency = request.priceCurrency;
  const amount = request.priceAmount;
  if (!currency || amount === null || !(amount > 0) || currency === 'FREE' || currency === 'BARTER') {
    return;
  }

  try {
    if (currency === 'SC') {
      await settleTripViaServiceCredits(trip, request, currency, amount);
      return;
    }

    await settleTripViaEarningsLedger(trip, currency, amount);
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'trip_settlement' });
  }
}

export async function triggerEmergencyStop(tripId: string, actorUserId: string, isAdmin: boolean, notes: string | null) {
  const result = await updateTripStatus(tripId, actorUserId, isAdmin, 'emergency_frozen', notes);

  await queryDb(
    `INSERT INTO trust_transport_risk_signals (request_id, trip_id, actor_user_id, target_user_id, signal_type, severity, notes)
     VALUES ($1::uuid, $2::uuid, $3, NULL, 'emergency_stop', 'critical', $4)`,
    [result.request.id, result.trip.id, actorUserId, normalizeNullableText(notes)],
  );

  return result;
}

export async function captureTripProof(tripId: string, actorUserId: string, isAdmin: boolean, artifactType: 'photo' | 'code' | 'note', artifactRedacted: string) {
  if (!validateTripProof(artifactType, artifactRedacted)) {
    throw new Error('invalid_payload');
  }

  const trip = await getTripById(tripId);
  if (!trip) {
    throw new Error('trip_not_found');
  }

  const isParticipant = trip.requesterUserId === actorUserId || trip.providerUserId === actorUserId;
  if (!isParticipant && !isAdmin) {
    throw new Error('policy_denied');
  }

  await queryDb(
    `INSERT INTO trust_transport_proof_artifacts (trip_id, artifact_type, artifact_redacted, captured_by_user_id)
     VALUES ($1::uuid, $2, $3, $4)`,
    [tripId, artifactType, normalizeText(artifactRedacted), actorUserId],
  );

  await queryDb(
    `INSERT INTO trust_transport_status_events (request_id, trip_id, actor_user_id, event_name, metadata)
     VALUES ($1::uuid, $2::uuid, $3, 'proof_captured', jsonb_build_object('artifactType', $4))`,
    [trip.requestId, trip.id, actorUserId, artifactType],
  );
}

export async function cancelOrder(orderId: string, actorUserId: string, isAdmin: boolean, reason: string | null) {
  const request = await getRequestById(orderId);
  if (!request) {
    throw new Error('request_not_found');
  }

  if (request.requesterUserId !== actorUserId && !isAdmin) {
    throw new Error('policy_denied');
  }

  if (!REQUEST_TRANSITIONS[request.status].includes('canceled')) {
    throw new Error('invalid_transition');
  }

  await queryDb(
    `UPDATE trust_transport_requests
     SET status = 'canceled', updated_at = NOW()
     WHERE id = $1::uuid`,
    [orderId],
  );

  await queryDb(
    `UPDATE trust_transport_trips
     SET status = CASE WHEN status IN ('completed', 'canceled') THEN status ELSE 'canceled' END,
         canceled_reason = COALESCE($2, canceled_reason),
         updated_at = NOW()
     WHERE request_id = $1::uuid`,
    [orderId, normalizeNullableText(reason)],
  );

  await queryDb(
    `INSERT INTO trust_transport_status_events (request_id, actor_user_id, event_name, from_status, to_status, metadata)
     VALUES ($1::uuid, $2, 'order_cancelled', $3, 'canceled', jsonb_build_object('reason', $4))`,
    [orderId, actorUserId, request.status, normalizeNullableText(reason)],
  );

  // Best-effort presence clear after the request is durably set to canceled. The requester (rider)
  // owns the request regardless of whether an admin performed the cancel. Never breaks the cancel.
  await syncTrustTransportRequestPresence(request.requesterUserId, orderId, 'canceled');
}

// The caller's recorded earnings per currency: the total value of the trips they completed, grouped by
// settlement currency (only currencies with a nonzero total). This is a read-only RECORD, not a
// withdrawable wallet balance — for anything other than ServiceCredits the platform has no payment
// processing, so the exchange is arranged peer-to-peer off-platform between the two people; the platform
// only records that a completed trip was worth this much. The same ledger feeds the GDP recognition
// layer, so these totals count toward the community's economic activity. Sums positive earning entries
// (`credit` + `release`) only, matching the GDP source (lib/gdp/recognition.ts); there is no longer any
// `hold`/`debit` side because the payout flow was removed (owner decision, 2026-07-08 — no platform payout
// for money the platform never processed).
export async function getRecordedEarningsByCurrency(userId: string): Promise<{ currency: string; amount: number }[]> {
  const result = await queryDb<{ currency: string; total: string }>(
    `SELECT currency, COALESCE(SUM(amount), 0)::text AS total
     FROM trust_transport_earnings_ledger
     WHERE provider_user_id = $1 AND entry_type IN ('credit', 'release')
     GROUP BY currency
     HAVING COALESCE(SUM(amount), 0) <> 0
     ORDER BY currency`,
    [userId],
  );

  return result.rows.map((row) => ({ currency: row.currency, amount: Number.parseFloat(row.total) }));
}

export async function getMarketConfig(): Promise<TrustTransportMarketConfig> {
  const result = await queryDb<{ config: Record<string, unknown> }>(
    `SELECT config
     FROM trust_transport_market_config
     WHERE id = TRUE
     LIMIT 1`,
  );

  const config = result.rows[0]?.config ?? {};

  return {
    maxConcurrentTrips: Number.isInteger(config.maxConcurrentTrips) ? (config.maxConcurrentTrips as number) : 3,
    requireProofOnDelivery: typeof config.requireProofOnDelivery === 'boolean' ? config.requireProofOnDelivery : true,
    emergencyFreezeEnabled: typeof config.emergencyFreezeEnabled === 'boolean' ? config.emergencyFreezeEnabled : true,
  };
}

export async function updateMarketConfig(actorUserId: string, input: TrustTransportMarketConfig): Promise<TrustTransportMarketConfig> {
  if (!Number.isInteger(input.maxConcurrentTrips) || input.maxConcurrentTrips < 1 || input.maxConcurrentTrips > 20) {
    throw new Error('invalid_payload');
  }

  await queryDb(
    `INSERT INTO trust_transport_market_config (id, config, updated_by_user_id, updated_at)
     VALUES (TRUE, $1::jsonb, $2, NOW())
     ON CONFLICT (id)
     DO UPDATE SET config = EXCLUDED.config, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = NOW()`,
    [JSON.stringify(input), actorUserId],
  );

  return getMarketConfig();
}

export async function restrictAccount(targetUserId: string, actorUserId: string, reason: string | null): Promise<void> {
  // Write the platform-wide restriction ('trading' scope) instead of the retired per-plugin column,
  // then keep the TrustTransport-specific risk-signal evidence row.
  await setSharedRestriction({ targetUserId, actorId: actorUserId, reason: normalizeNullableText(reason), scope: 'trading' });

  await queryDb(
    `INSERT INTO trust_transport_risk_signals (request_id, trip_id, actor_user_id, target_user_id, signal_type, severity, notes)
     VALUES (NULL, NULL, $1, $2, 'account_restricted', 'high', $3)`,
    [actorUserId, targetUserId, normalizeNullableText(reason)],
  );
}

export async function restoreAccount(targetUserId: string, actorUserId: string): Promise<void> {
  await clearSharedRestriction({ targetUserId, actorId: actorUserId });

  await queryDb(
    `INSERT INTO trust_transport_risk_signals (request_id, trip_id, actor_user_id, target_user_id, signal_type, severity, notes, is_resolved, resolved_by_user_id, resolved_at)
     VALUES (NULL, NULL, $1, $2, 'policy_flag', 'low', 'account_restored', TRUE, $1, NOW())`,
    [actorUserId, targetUserId],
  );
}

export async function listIncidents(): Promise<TrustTransportIncident[]> {
  const disputes = await queryDb<{
    id: string;
    status: 'open' | 'resolved' | 'dismissed';
    reason: string;
    request_id: string;
    trip_id: string;
    opened_by_user_id: string;
    created_at: Date;
  }>(
    `SELECT id, status, reason, request_id, trip_id, opened_by_user_id, created_at
     FROM trust_transport_disputes
     ORDER BY created_at DESC
     LIMIT 100`,
  );

  const signals = await queryDb<{
    id: string;
    is_resolved: boolean;
    notes: string | null;
    request_id: string | null;
    trip_id: string | null;
    actor_user_id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    created_at: Date;
  }>(
    `SELECT id, is_resolved, notes, request_id, trip_id, actor_user_id, severity, created_at
     FROM trust_transport_risk_signals
     ORDER BY created_at DESC
     LIMIT 100`,
  );

  const mappedDisputes: TrustTransportIncident[] = disputes.rows.map((row) => ({
    id: row.id,
    kind: 'dispute',
    status: row.status,
    severity: 'high',
    reason: row.reason,
    requestId: row.request_id,
    tripId: row.trip_id,
    openedByUserId: row.opened_by_user_id,
    createdAtIso: toIso(row.created_at),
  }));

  const mappedSignals: TrustTransportIncident[] = signals.rows.map((row) => ({
    id: row.id,
    kind: 'risk_signal',
    status: row.is_resolved ? 'resolved' : 'open',
    severity: row.severity,
    reason: row.notes ?? 'risk_signal',
    requestId: row.request_id,
    tripId: row.trip_id,
    openedByUserId: row.actor_user_id,
    createdAtIso: toIso(row.created_at),
  }));

  return [...mappedDisputes, ...mappedSignals].sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
}

export async function resolveIncident(incidentId: string, actorUserId: string, resolutionNotes: string | null): Promise<void> {
  const disputeUpdate = await queryDb(
    `UPDATE trust_transport_disputes
     SET status = 'resolved',
         resolution_notes = $2,
         resolved_by_user_id = $3,
         resolved_at = NOW(),
         updated_at = NOW()
     WHERE id = $1::uuid
       AND status = 'open'`,
    [incidentId, normalizeNullableText(resolutionNotes), actorUserId],
  );

  if ((disputeUpdate.rowCount ?? 0) > 0) {
    return;
  }

  const signalUpdate = await queryDb(
    `UPDATE trust_transport_risk_signals
     SET is_resolved = TRUE,
         resolved_by_user_id = $2,
         resolved_at = NOW(),
         notes = COALESCE($3, notes)
     WHERE id = $1::uuid
       AND is_resolved = FALSE`,
    [incidentId, actorUserId, normalizeNullableText(resolutionNotes)],
  );

  if ((signalUpdate.rowCount ?? 0) === 0) {
    throw new Error('incident_not_found');
  }
}

export async function listAuditEvents() {
  const result = await queryDb<{
    id: string;
    actor_id: string;
    command: string;
    policy_status: 'allow' | 'deny';
    reason: string;
    target_type: string;
    target_id: string;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(
    `SELECT id, actor_id, command, policy_status, reason, target_type, target_id, metadata, created_at
     FROM trust_transport_admin_audit_trail
     ORDER BY created_at DESC
     LIMIT 200`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    command: row.command,
    policyStatus: row.policy_status,
    reason: row.reason,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata ?? {},
    createdAtIso: toIso(row.created_at),
  }));
}

export async function insertTrustTransportAudit(input: AuditInput): Promise<void> {
  await queryDb(
    `INSERT INTO trust_transport_admin_audit_trail (actor_id, command, policy_status, reason, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
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
