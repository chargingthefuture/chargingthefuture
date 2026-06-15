import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { getCurrency } from 'lib/currency/repository';
import {
  getAccountRestrictionStatus,
  restrictAccount as setSharedRestriction,
  unrestrictAccount as clearSharedRestriction,
} from 'lib/auth/account-restrictions';
import {
  TRUSTTRANSPORT_DEFAULT_PAGE,
  TRUSTTRANSPORT_DEFAULT_PAGE_SIZE,
  TRUSTTRANSPORT_MAX_DETAILS_LENGTH,
  TRUSTTRANSPORT_MAX_FEEDBACK_LENGTH,
  TRUSTTRANSPORT_MAX_PAGE_SIZE,
  TRUSTTRANSPORT_MAX_PROOF_LENGTH,
  TRUSTTRANSPORT_MAX_TITLE_LENGTH,
  TRUSTTRANSPORT_MODES,
} from './constants';
import type {
  TrustTransportIncident,
  TrustTransportMarketConfig,
  TrustTransportMode,
  TrustTransportOffer,
  TrustTransportPayoutRequest,
  TrustTransportRatingInput,
  TrustTransportRequest,
  TrustTransportRequestInput,
  TrustTransportTrip,
  TrustTransportTripStatus,
} from './types';
import { ensureTrustTransportTripChannel } from './stream';

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
  cancelled_reason: string | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type PayoutRow = {
  id: string;
  provider_user_id: string;
  amount: string;
  currency: string;
  status: TrustTransportPayoutRequest['status'];
  requested_at: Date;
  decided_at: Date | null;
  decided_by_user_id: string | null;
  decision_reason: string | null;
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
  open: ['accepted', 'cancelled', 'emergency_frozen'],
  accepted: ['in_progress', 'cancelled', 'disputed', 'emergency_frozen'],
  in_progress: ['completed', 'cancelled', 'disputed', 'emergency_frozen'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
  emergency_frozen: ['disputed', 'cancelled'],
};

const TRIP_TRANSITIONS: Record<TrustTransportTrip['status'], TrustTransportTripStatus[]> = {
  assigned: ['en_route', 'cancelled', 'disputed', 'emergency_frozen'],
  en_route: ['picked_up', 'cancelled', 'disputed', 'emergency_frozen'],
  picked_up: ['delivered', 'cancelled', 'disputed', 'emergency_frozen'],
  delivered: ['completed', 'disputed', 'emergency_frozen'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
  emergency_frozen: ['disputed', 'cancelled'],
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
    return TRUSTTRANSPORT_DEFAULT_PAGE;
  }

  return value;
}

function normalizePageSize(value: number | null | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return TRUSTTRANSPORT_DEFAULT_PAGE_SIZE;
  }

  return Math.min(value, TRUSTTRANSPORT_MAX_PAGE_SIZE);
}

function isMode(value: string): value is TrustTransportMode {
  return (TRUSTTRANSPORT_MODES as readonly string[]).includes(value);
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
    cancelledReason: row.cancelled_reason,
    completedAtIso: row.completed_at ? toIso(row.completed_at) : null,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

function mapPayoutRow(row: PayoutRow): TrustTransportPayoutRequest {
  return {
    id: row.id,
    providerUserId: row.provider_user_id,
    amount: Number.parseFloat(row.amount),
    currency: row.currency,
    status: row.status,
    requestedAtIso: toIso(row.requested_at),
    decidedAtIso: row.decided_at ? toIso(row.decided_at) : null,
    decidedByUserId: row.decided_by_user_id,
    decisionReason: row.decision_reason,
  };
}

export function validateRequestInput(input: TrustTransportRequestInput): boolean {
  if (!isMode(input.mode)) {
    return false;
  }

  const title = normalizeText(input.title);
  const details = normalizeText(input.details);

  if (title.length === 0 || title.length > TRUSTTRANSPORT_MAX_TITLE_LENGTH) {
    return false;
  }

  if (details.length === 0 || details.length > TRUSTTRANSPORT_MAX_DETAILS_LENGTH) {
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
  return normalized.length > 0 && normalized.length <= TRUSTTRANSPORT_MAX_PROOF_LENGTH;
}

export function validateRatingInput(input: TrustTransportRatingInput): boolean {
  const feedback = normalizeNullableText(input.feedback);

  return Number.isInteger(input.score)
    && input.score >= 1
    && input.score <= 5
    && (!feedback || feedback.length <= TRUSTTRANSPORT_MAX_FEEDBACK_LENGTH);
}

async function ensureUserNotRestricted(userId: string): Promise<void> {
  // Reads the platform-wide restriction signal ('trading' scope), not the retired per-plugin column.
  const restriction = await getAccountRestrictionStatus(userId, 'trading');
  if (restriction.isRestricted) {
    throw new Error('account_restricted');
  }
}

export async function listModes() {
  return TRUSTTRANSPORT_MODES;
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

  return withDbTransaction(async (client) => {
    const existing = await client.query<RequestRow>(
      `SELECT id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at
       FROM trusttransport_requests
       WHERE requester_user_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [actorUserId, idempotencyKey],
    );

    if ((existing.rowCount ?? 0) > 0) {
      return mapRequestRow(existing.rows[0]);
    }

    const created = await client.query<RequestRow>(
      `INSERT INTO trusttransport_requests (
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
      `INSERT INTO trusttransport_status_events (request_id, actor_user_id, event_name, metadata)
       VALUES ($1::uuid, $2, 'request_created', '{}'::jsonb)`,
      [created.rows[0].id, actorUserId],
    );

    return mapRequestRow(created.rows[0]);
  });
}

export async function getRequestById(requestId: string): Promise<TrustTransportRequest | null> {
  const result = await queryDb<RequestRow>(
    `SELECT id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at
     FROM trusttransport_requests
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
     FROM trusttransport_requests
     WHERE ($1::text IS NULL OR requester_user_id = $1)`,
    [requesterUserId],
  );
  const total = Number.parseInt(count.rows[0]?.total ?? '0', 10);

  const result = await queryDb<RequestRow>(
    `SELECT id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at
     FROM trusttransport_requests
     WHERE ($1::text IS NULL OR requester_user_id = $1)
     ORDER BY created_at DESC
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
     FROM trusttransport_offers
     WHERE request_id = $1::uuid
     ORDER BY created_at ASC`,
    [requestId],
  );

  return result.rows.map(mapOfferRow);
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
       FROM trusttransport_offers
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
      `SELECT id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, cancelled_reason, completed_at, created_at, updated_at
       FROM trusttransport_trips
       WHERE request_id = $1::uuid
       LIMIT 1`,
      [requestId],
    );

    if ((existingTrip.rowCount ?? 0) > 0) {
      const requestUpdate = await client.query<RequestRow>(
        `SELECT id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at
         FROM trusttransport_requests
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
      `UPDATE trusttransport_offers
       SET status = CASE WHEN id = $1::uuid THEN 'accepted' ELSE 'rejected' END,
           updated_at = NOW()
       WHERE request_id = $2::uuid`,
      [offerId, requestId],
    );

    const tripResult = await client.query<TripRow>(
      `INSERT INTO trusttransport_trips (request_id, offer_id, requester_user_id, provider_user_id, mode, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'assigned')
       RETURNING id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, cancelled_reason, completed_at, created_at, updated_at`,
      [requestId, offerId, request.requesterUserId, offer.provider_user_id, request.mode],
    );

    const requestResult = await client.query<RequestRow>(
      `UPDATE trusttransport_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at`,
      [requestId],
    );

    await client.query(
      `INSERT INTO trusttransport_status_events (request_id, trip_id, actor_user_id, event_name, from_status, to_status, metadata)
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
      `UPDATE trusttransport_trips
       SET stream_channel_id = $2, updated_at = NOW()
       WHERE id = $1::uuid`,
      [created.trip.id, streamChannelId],
    );

    created.trip.streamChannelId = streamChannelId;
  }

  return created;
}

export async function getTripById(tripId: string): Promise<TrustTransportTrip | null> {
  const result = await queryDb<TripRow>(
    `SELECT id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, cancelled_reason, completed_at, created_at, updated_at
     FROM trusttransport_trips
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

function mapRequestStatusFromTrip(nextStatus: TrustTransportTripStatus): TrustTransportRequest['status'] {
  if (nextStatus === 'assigned' || nextStatus === 'en_route' || nextStatus === 'picked_up') {
    return 'in_progress';
  }

  if (nextStatus === 'delivered' || nextStatus === 'completed') {
    return 'completed';
  }

  if (nextStatus === 'cancelled') {
    return 'cancelled';
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
  return withDbTransaction(async (client) => {
    const tripResult = await client.query<TripRow>(
      `SELECT id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, cancelled_reason, completed_at, created_at, updated_at
       FROM trusttransport_trips
       WHERE id = $1::uuid
       LIMIT 1
       FOR UPDATE`,
      [tripId],
    );

    if ((tripResult.rowCount ?? 0) === 0) {
      throw new Error('trip_not_found');
    }

    const trip = tripResult.rows[0];
    const isParticipant = trip.requester_user_id === actorUserId || trip.provider_user_id === actorUserId;
    if (!isParticipant && !isAdmin) {
      throw new Error('policy_denied');
    }

    assertTripTransition(trip.status, nextStatus);

    const nextRequestStatus = mapRequestStatusFromTrip(nextStatus);

    if (!(REQUEST_TRANSITIONS[nextRequestStatus] || REQUEST_TRANSITIONS.open)) {
      throw new Error('invalid_transition');
    }

    const updatedTripResult = await client.query<TripRow>(
      `UPDATE trusttransport_trips
       SET status = $2,
           cancelled_reason = CASE WHEN $2 = 'cancelled' THEN $3 ELSE cancelled_reason END,
           completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, cancelled_reason, completed_at, created_at, updated_at`,
      [tripId, nextStatus, normalizeNullableText(note)],
    );

    const updatedRequestResult = await client.query<RequestRow>(
      `UPDATE trusttransport_requests
       SET status = $2, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, requester_user_id, mode, title, details, pickup_city, dropoff_city, pickup_geo_redacted, dropoff_geo_redacted, status, price_amount, price_currency, created_at, updated_at`,
      [trip.request_id, nextRequestStatus],
    );

    await client.query(
      `INSERT INTO trusttransport_status_events (request_id, trip_id, actor_user_id, event_name, from_status, to_status, metadata)
       VALUES ($1::uuid, $2::uuid, $3, 'trip_status_updated', $4, $5, jsonb_build_object('note', $6))`,
      [trip.request_id, trip.id, actorUserId, trip.status, nextStatus, normalizeNullableText(note)],
    );

    if (nextStatus === 'disputed') {
      await client.query(
        `INSERT INTO trusttransport_disputes (trip_id, request_id, opened_by_user_id, reason, status)
         VALUES ($1::uuid, $2::uuid, $3, $4, 'open')`,
        [trip.id, trip.request_id, actorUserId, normalizeNullableText(note) ?? 'status_dispute'],
      );
    }

    return {
      trip: mapTripRow(updatedTripResult.rows[0]),
      request: mapRequestRow(updatedRequestResult.rows[0]),
    };
  });
}

export async function triggerEmergencyStop(tripId: string, actorUserId: string, isAdmin: boolean, notes: string | null) {
  const result = await updateTripStatus(tripId, actorUserId, isAdmin, 'emergency_frozen', notes);

  await queryDb(
    `INSERT INTO trusttransport_risk_signals (request_id, trip_id, actor_user_id, target_user_id, signal_type, severity, notes)
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
    `INSERT INTO trusttransport_proof_artifacts (trip_id, artifact_type, artifact_redacted, captured_by_user_id)
     VALUES ($1::uuid, $2, $3, $4)`,
    [tripId, artifactType, normalizeText(artifactRedacted), actorUserId],
  );

  await queryDb(
    `INSERT INTO trusttransport_status_events (request_id, trip_id, actor_user_id, event_name, metadata)
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

  if (!REQUEST_TRANSITIONS[request.status].includes('cancelled')) {
    throw new Error('invalid_transition');
  }

  await queryDb(
    `UPDATE trusttransport_requests
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1::uuid`,
    [orderId],
  );

  await queryDb(
    `UPDATE trusttransport_trips
     SET status = CASE WHEN status IN ('completed', 'cancelled') THEN status ELSE 'cancelled' END,
         cancelled_reason = COALESCE($2, cancelled_reason),
         updated_at = NOW()
     WHERE request_id = $1::uuid`,
    [orderId, normalizeNullableText(reason)],
  );

  await queryDb(
    `INSERT INTO trusttransport_status_events (request_id, actor_user_id, event_name, from_status, to_status, metadata)
     VALUES ($1::uuid, $2, 'order_cancelled', $3, 'cancelled', jsonb_build_object('reason', $4))`,
    [orderId, actorUserId, request.status, normalizeNullableText(reason)],
  );
}

export async function submitOrderRating(orderId: string, actorUserId: string, isAdmin: boolean, input: TrustTransportRatingInput) {
  if (!validateRatingInput(input)) {
    throw new Error('invalid_payload');
  }

  const request = await getRequestById(orderId);
  if (!request) {
    throw new Error('request_not_found');
  }

  if (request.requesterUserId !== actorUserId && !isAdmin) {
    throw new Error('policy_denied');
  }

  const tripResult = await queryDb<TripRow>(
    `SELECT id, request_id, offer_id, requester_user_id, provider_user_id, mode, status, stream_channel_id, cancelled_reason, completed_at, created_at, updated_at
     FROM trusttransport_trips
     WHERE request_id = $1::uuid
     LIMIT 1`,
    [orderId],
  );

  if ((tripResult.rowCount ?? 0) === 0) {
    throw new Error('trip_not_found');
  }

  const trip = tripResult.rows[0];

  await queryDb(
    `INSERT INTO trusttransport_ratings (trip_id, requester_user_id, provider_user_id, score, feedback)
     VALUES ($1::uuid, $2, $3, $4, $5)
     ON CONFLICT (trip_id)
     DO UPDATE SET
       score = EXCLUDED.score,
       feedback = EXCLUDED.feedback`,
    [trip.id, actorUserId, trip.provider_user_id, input.score, normalizeNullableText(input.feedback)],
  );
}

async function getProviderAvailableBalance(providerUserId: string): Promise<number> {
  const result = await queryDb<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE
       WHEN entry_type IN ('credit', 'release') THEN amount
       WHEN entry_type IN ('debit', 'hold') THEN -amount
       ELSE 0
     END), 0)::text AS balance
     FROM trusttransport_earnings_ledger
     WHERE provider_user_id = $1`,
    [providerUserId],
  );

  return Number.parseFloat(result.rows[0]?.balance ?? '0');
}

export async function requestPayout(providerUserId: string, amount: number, idempotencyKey: string): Promise<TrustTransportPayoutRequest> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_payload');
  }

  const available = await getProviderAvailableBalance(providerUserId);
  if (available < amount) {
    throw new Error('insufficient_balance');
  }

  const result = await withDbTransaction(async (client) => {
    const existing = await client.query<PayoutRow>(
      `SELECT id, provider_user_id, amount, currency, status, requested_at, decided_at, decided_by_user_id, decision_reason
       FROM trusttransport_payout_requests
       WHERE provider_user_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [providerUserId, idempotencyKey],
    );

    if ((existing.rowCount ?? 0) > 0) {
      return existing.rows[0];
    }

    const created = await client.query<PayoutRow>(
      `INSERT INTO trusttransport_payout_requests (provider_user_id, amount, currency, status, idempotency_key)
       VALUES ($1, $2, 'USD', 'requested', $3)
       RETURNING id, provider_user_id, amount, currency, status, requested_at, decided_at, decided_by_user_id, decision_reason`,
      [providerUserId, amount, idempotencyKey],
    );

    await client.query(
      `INSERT INTO trusttransport_earnings_ledger (provider_user_id, entry_type, amount, currency, status, metadata)
       VALUES ($1, 'hold', $2, 'USD', 'held', jsonb_build_object('reason', 'payout_request', 'idempotencyKey', $3))`,
      [providerUserId, amount, idempotencyKey],
    );

    return created.rows[0];
  });

  return mapPayoutRow(result);
}

export async function listMyPayouts(providerUserId: string): Promise<TrustTransportPayoutRequest[]> {
  const result = await queryDb<PayoutRow>(
    `SELECT id, provider_user_id, amount, currency, status, requested_at, decided_at, decided_by_user_id, decision_reason
     FROM trusttransport_payout_requests
     WHERE provider_user_id = $1
     ORDER BY requested_at DESC`,
    [providerUserId],
  );

  return result.rows.map(mapPayoutRow);
}

export async function getMarketConfig(): Promise<TrustTransportMarketConfig> {
  const result = await queryDb<{ config: Record<string, unknown> }>(
    `SELECT config
     FROM trusttransport_market_config
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
    `INSERT INTO trusttransport_market_config (id, config, updated_by_user_id, updated_at)
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
    `INSERT INTO trusttransport_risk_signals (request_id, trip_id, actor_user_id, target_user_id, signal_type, severity, notes)
     VALUES (NULL, NULL, $1, $2, 'account_restricted', 'high', $3)`,
    [actorUserId, targetUserId, normalizeNullableText(reason)],
  );
}

export async function restoreAccount(targetUserId: string, actorUserId: string): Promise<void> {
  await clearSharedRestriction({ targetUserId, actorId: actorUserId });

  await queryDb(
    `INSERT INTO trusttransport_risk_signals (request_id, trip_id, actor_user_id, target_user_id, signal_type, severity, notes, is_resolved, resolved_by_user_id, resolved_at)
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
     FROM trusttransport_disputes
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
     FROM trusttransport_risk_signals
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
    `UPDATE trusttransport_disputes
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
    `UPDATE trusttransport_risk_signals
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
     FROM trusttransport_admin_audit_trail
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
    `INSERT INTO trusttransport_admin_audit_trail (actor_id, command, policy_status, reason, target_type, target_id, metadata)
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
