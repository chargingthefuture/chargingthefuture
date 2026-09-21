import { randomUUID } from 'crypto';
import { createTransfer } from 'lib/shared/service-credits/createTransfer';
import type { ChymeServiceCreditsTransaction } from './types';
import { sendChymeStreamMessage } from './stream';
import { deleteBackChannelForUser } from './back-channel';

export async function sendServiceCredits(
  fromUserId: string,
  toUserId: string,
  amount: number,
  message?: string,
  // Optional idempotency key, normally derived from a stable client-supplied nonce by the route, so a
  // retried tip (e.g. after a network failure) deduplicates instead of double-charging. When absent we
  // mint a fresh per-request UUID — never `Date.now()`, which read like a dedup key but collides under
  // load and gave no real idempotency.
  idempotencyKey?: string,
): Promise<ChymeServiceCreditsTransaction> {
  const tx = await createTransfer({
    senderUserId: fromUserId,
    recipientUserId: toUserId,
    amount,
    idempotencyKey: idempotencyKey ?? `chyme-${fromUserId}-${randomUUID()}`,
    originPlugin: 'chyme',
    reasonCode: message && message.trim().length > 0 ? 'chyme.transfer.message' : 'chyme.transfer',
  });

  const status: ChymeServiceCreditsTransaction['status'] =
    tx.status === 'completed' ? 'completed' : tx.status === 'pending' ? 'pending' : 'failed';

  return {
    id: tx.id,
    fromUserId,
    toUserId,
    amount,
    message,
    createdAtIso: new Date().toISOString(),
    status,
  };
}
import type { PoolClient } from 'pg';
import {
  CHYME_DEFAULT_MESSAGES_LIMIT,
  CHYME_MAIN_ROOM_KEY,
  CHYME_MAIN_ROOM_NAME,
  CHYME_MAX_MESSAGE_LENGTH,
  CHYME_PRESENCE_TTL_SECONDS,
  chymeRoomNameForKey,
  isChymeSpeakMode,
  type ChymeSpeakMode,
} from './constants';
import type {
  ChymeDeletionResponse,
  ChymeMessage,
  ChymeParticipant,
  ChymeRoomResponse,
} from './types';
import { withDbTransaction } from 'lib/db/postgres';
import { STREAM_VIDEO_SURFACE, chymeRoomSurface } from 'lib/stream-quota/constants';
import { resolveChymeQuotaPolicy, type ChymeQuotaPolicy } from 'lib/stream-quota/policy';
import { readStreamVideoQuotaBand, recordStreamVideoUsage } from 'lib/stream-quota/usage';

// Thrown by markRoomCallJoined when the room already holds as many members as the cap in force
// allows. The join route answers 409 with the message; the client shows it in place of the stage.
export class ChymeRoomFullError extends Error {
  readonly capacity: { current: number; max: number };
  constructor(current: number, max: number) {
    super(`This room is full right now (${max} of ${max} people). Try again in a minute.`);
    this.name = 'ChymeRoomFullError';
    this.capacity = { current, max };
  }
}

export type IdentityInput = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
};

// Thrown when an admin removed this member from the room (chyme_room_removals, not lifted). The
// join and heartbeat routes answer 403 with the message; the apps show it in place of the stage.
export class ChymeRemovedError extends Error {
  constructor() {
    super('An admin removed you from this room. You can come back once an admin lets you back in.');
    this.name = 'ChymeRemovedError';
  }
}

export type RoomRow = {
  id: string;
  room_key: string;
  room_name: string;
  call_active: boolean;
  speak_mode: string;
};

type ParticipantRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  role: 'speaker' | 'listener';
  hand_raised: boolean;
  joined_at: Date;
  last_seen_at: Date;
};

type MessageRow = {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  text: string;
  sent_at: Date;
};

type DeletionEventRow = {
  id: string;
  requested_at: Date;
};

type TreasuryConfigRow = {
  policy: Record<string, unknown>;
};

export function chymeHandle(username: string | null, userId: string): string {
  if (username) {
    return `@${username}`;
  }

  return `user-${userId.slice(0, 8)}`;
}

function mapParticipant(row: ParticipantRow): ChymeParticipant {
  return {
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    role: row.role,
    handRaised: row.hand_raised,
    joinedAtIso: row.joined_at.toISOString(),
    lastSeenAtIso: row.last_seen_at.toISOString(),
  };
}

function mapMessage(row: MessageRow): ChymeMessage {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    text: row.text,
    sentAtIso: row.sent_at.toISOString(),
  };
}

function sanitizeMessageText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function readTreasuryUserId(policy: Record<string, unknown> | null | undefined): string | null {
  if (!policy) {
    return null;
  }

  const direct = policy.treasuryUserId;
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }

  const snakeCase = policy.treasury_user_id;
  if (typeof snakeCase === 'string' && snakeCase.trim().length > 0) {
    return snakeCase.trim();
  }

  return null;
}

async function enqueueServiceCreditsDeletionReclaim(
  client: PoolClient,
  userId: string,
  deletionRequestId: string,
  requestedAtIso: string,
): Promise<void> {
  const treasuryConfig = await client.query<TreasuryConfigRow>(
    `SELECT policy FROM service_credits_treasury_config WHERE id = TRUE LIMIT 1`,
  );

  const treasuryUserId = readTreasuryUserId(treasuryConfig.rows[0]?.policy);
  const requestId = `chyme-account-delete:${deletionRequestId}`;
  const traceId = randomUUID();
  const idempotencyKey = `chyme-account-delete:${deletionRequestId}`;

  await client.query(
    `INSERT INTO service_credits_account_deletion_reclaims
      (id, user_id, account_id, deletion_request_id, treasury_user_id, amount_transferred, request_id, trace_id, actor_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 'chyme_full_account_delete', $8)
     ON CONFLICT (account_id, deletion_request_id)
     DO UPDATE SET
       treasury_user_id = EXCLUDED.treasury_user_id,
       request_id = EXCLUDED.request_id,
       trace_id = EXCLUDED.trace_id,
       actor_id = EXCLUDED.actor_id,
       idempotency_key = EXCLUDED.idempotency_key`,
    [randomUUID(), userId, userId, deletionRequestId, treasuryUserId, requestId, traceId, idempotencyKey],
  );

  await client.query(
    `INSERT INTO service_credits_adapter_outbox
      (id, command_name, idempotency_key, provider, status, payload, last_error, attempt_count)
     VALUES ($1, 'account.deletion.reclaim.execute', $2, 'formance', 'queued', $3::jsonb, NULL, 0)
     ON CONFLICT (command_name, idempotency_key)
     DO UPDATE SET payload = EXCLUDED.payload, status = 'queued', updated_at = NOW()`,
    [
      randomUUID(),
      idempotencyKey,
      JSON.stringify({
        accountId: userId,
        deletionRequestId,
        treasuryUserId,
        requestedAt: requestedAtIso,
        requestId,
        traceId,
        idempotencyKey,
      }),
    ],
  );
}

// Read-only fetch of the one main room. The public, unauthenticated live-state endpoint must NOT
// write (ensureMainRoom upserts on every call), so it uses this instead — otherwise a public page
// turns every read into row-write traffic. Returns null if the room has never been created.
async function getMainRoomReadOnly(client: PoolClient): Promise<RoomRow | null> {
  const result = await client.query<RoomRow>(
    `SELECT id, room_key, room_name, call_active, speak_mode FROM chyme_rooms WHERE room_key = $1 LIMIT 1`,
    [CHYME_MAIN_ROOM_KEY],
  );
  return result.rows[0] ?? null;
}

// Upsert a Chyme room row by key and return it. Defaults to the open main room; the private
// contributors room passes CHYME_CONTRIBUTORS_ROOM_KEY. The room name is resolved from the known-key
// map, never from caller input, so an arbitrary key can never set an arbitrary display name.
export async function ensureRoom(client: PoolClient, roomKey: string = CHYME_MAIN_ROOM_KEY): Promise<RoomRow> {
  const inserted = await client.query<RoomRow>(
    `
      INSERT INTO chyme_rooms (room_key, room_name, call_active)
      VALUES ($1, $2, false)
      ON CONFLICT (room_key)
      DO UPDATE SET room_name = EXCLUDED.room_name
      RETURNING id, room_key, room_name, call_active, speak_mode
    `,
    [roomKey, chymeRoomNameForKey(roomKey)],
  );

  return inserted.rows[0];
}

async function setRoomCallActive(
  client: PoolClient,
  roomId: string,
  callActive: boolean,
): Promise<RoomRow> {
  const updatedRoom = await client.query<RoomRow>(
    `
      UPDATE chyme_rooms
      SET call_active = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, room_key, room_name, call_active, speak_mode
    `,
    [roomId, callActive],
  );

  return updatedRoom.rows[0];
}

async function ensureServiceProfile(client: PoolClient, identity: IdentityInput): Promise<void> {
  await client.query(
    `
      INSERT INTO chyme_service_profiles (user_id, status, created_at, updated_at, deleted_at)
      VALUES ($1, 'active', NOW(), NOW(), NULL)
      ON CONFLICT (user_id)
      DO UPDATE SET status = 'active', updated_at = NOW(), deleted_at = NULL
    `,
    [identity.userId],
  );
}

// Upsert the member's presence row and return how many seconds of connected time this heartbeat
// stands for: the gap since the previous last_seen_at, capped at the presence window. A gap longer
// than the window means the member was not counted as present across it (they dropped out and came
// back), so it credits nothing rather than the full absence. The sub-select in RETURNING reads the
// row as it was before this statement ran, which is the previous last_seen_at.
async function upsertMember(client: PoolClient, roomId: string, identity: IdentityInput): Promise<number> {
  const result = await client.query<{ credited_seconds: string | null }>(
    `
      INSERT INTO chyme_room_members (
        room_id,
        user_id,
        username,
        avatar_url,
        role,
        joined_at,
        last_seen_at
      )
      VALUES ($1, $2, $3, $4, 'listener', NOW(), NOW())
      ON CONFLICT (room_id, user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url,
        last_seen_at = NOW()
      RETURNING (
        SELECT CASE
          WHEN NOW() - previous.last_seen_at <= ($5 || ' seconds')::interval
            THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - previous.last_seen_at)))::text
          ELSE '0'
        END
        FROM chyme_room_members AS previous
        WHERE previous.room_id = $1 AND previous.user_id = $2
      ) AS credited_seconds
    `,
    [roomId, identity.userId, identity.username, identity.avatarUrl, String(CHYME_PRESENCE_TTL_SECONDS)],
  );
  return Number(result.rows[0]?.credited_seconds ?? 0);
}

// The quota band → policy for this request. Read once per route call; the band is a one-row sum.
export async function readQuotaPolicy(client: PoolClient): Promise<ChymeQuotaPolicy> {
  return resolveChymeQuotaPolicy(await readStreamVideoQuotaBand(client));
}

export async function getChymeQuotaPolicy(): Promise<ChymeQuotaPolicy> {
  return withDbTransaction((client) => readQuotaPolicy(client));
}

// Who is reading: whether they may moderate, and their own role in this room. An admin is always
// a speaker; a member's role is their presence row's, 'listener' until they join.
export type RoomViewer = { userId: string; isAdmin: boolean };

export function roomSpeakMode(room: RoomRow): ChymeSpeakMode {
  return isChymeSpeakMode(room.speak_mode) ? room.speak_mode : 'open';
}

export function toRoomResponse(
  room: RoomRow,
  participants: ChymeParticipant[],
  policy: ChymeQuotaPolicy,
  viewer: RoomViewer,
  guestCount: number = 0,
): ChymeRoomResponse {
  const own = participants.find((participant) => participant.userId === viewer.userId);
  return {
    roomId: room.id,
    roomName: room.room_name,
    roomKey: room.room_key,
    // "Live" reflects whether anyone is actually in the call right now (fresh presence),
    // not a stored flag that nothing turns off.
    callActive: participants.length > 0,
    participants,
    guestCount,
    capacity: { current: participants.length, max: policy.memberCap },
    quota: {
      band: policy.band,
      notice: policy.memberNotice,
      guestListenAllowed: policy.guestListenAllowed,
      backChannelAllowed: policy.backChannelAllowed,
    },
    speakMode: roomSpeakMode(room),
    viewer: { isAdmin: viewer.isAdmin, role: viewer.isAdmin ? 'speaker' : (own?.role ?? 'listener') },
  };
}

// Throws ChymeRemovedError when an admin removed this member from the room and nobody has let them
// back in. Checked on join and on every heartbeat, so a removed member's client cannot keep a
// presence row alive after the removal.
export async function assertNotRemoved(client: PoolClient, roomId: string, userId: string): Promise<void> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM chyme_room_removals WHERE room_id = $1 AND user_id = $2 AND lifted_at IS NULL LIMIT 1`,
    [roomId, userId],
  );
  if ((result.rowCount ?? 0) > 0) {
    throw new ChymeRemovedError();
  }
}

export async function listRoomParticipants(client: PoolClient, roomId: string): Promise<ChymeParticipant[]> {
  // Only members seen within the presence window count as "in the call". A member who left
  // (row deleted) or disconnected (heartbeat stopped, last_seen_at goes stale) drops off
  // automatically — there is no realtime socket, so freshness is how presence expires.
  const result = await client.query<ParticipantRow>(
    `
      SELECT
        user_id,
        username,
        avatar_url,
        role,
        hand_raised,
        joined_at,
        last_seen_at
      FROM chyme_room_members
      WHERE room_id = $1
        AND last_seen_at > NOW() - ($2 || ' seconds')::interval
      ORDER BY joined_at ASC
    `,
    [roomId, String(CHYME_PRESENCE_TTL_SECONDS)],
  );

  return result.rows.map(mapParticipant);
}

export async function getRoomState(
  identity: IdentityInput,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
  viewerIsAdmin: boolean = false,
): Promise<ChymeRoomResponse> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await ensureServiceProfile(client, identity);
    // Viewing the room does NOT make you a participant — only joining the call does (see
    // markRoomCallJoined). Otherwise merely opening Chyme would list you on stage forever.
    const [participants, policy, guestCount] = await Promise.all([
      listRoomParticipants(client, room.id),
      readQuotaPolicy(client),
      countGuestsInRoom(client, room.room_key),
    ]);

    return toRoomResponse(room, participants, policy, { userId: identity.userId, isAdmin: viewerIsAdmin }, guestCount);
  });
}

// Public, no-identity view of the one default room's live state. Used by the signed-out guest path
// so a visitor can see whether the room is live and listen in. Unlike getRoomState it does NOT create
// a service profile or otherwise touch the viewer — a guest is not a member.
export type ChymePublicRoomLiveState = {
  roomName: string;
  roomKey: string;
  callActive: boolean;
  participantCount: number;
  // Signed-out listeners currently inside the presence window.
  guestCount: number;
  policy: ChymeQuotaPolicy;
};

export async function getPublicRoomLiveState(): Promise<ChymePublicRoomLiveState> {
  return withDbTransaction(async (client) => {
    const [room, policy] = await Promise.all([getMainRoomReadOnly(client), readQuotaPolicy(client)]);
    if (!room) {
      // Room not created yet (no member has ever opened Chyme): nothing to listen to.
      return { roomName: CHYME_MAIN_ROOM_NAME, roomKey: CHYME_MAIN_ROOM_KEY, callActive: false, participantCount: 0, guestCount: 0, policy };
    }
    const [participants, guestCount] = await Promise.all([listRoomParticipants(client, room.id), countFreshGuests(client)]);
    return {
      roomName: room.room_name,
      roomKey: room.room_key,
      callActive: participants.length > 0,
      participantCount: participants.length,
      guestCount,
      policy,
    };
  });
}

// --- Signed-out listeners (the public main room) ---
//
// A guest is one browser holding one random id in an httpOnly cookie. The roster below is what the
// guest listener cap counts and what the minute meter credits; it carries no personal data.

// The guest roster is not per room: a signed-out listener can only ever reach the public main room,
// so every other room key has no guests by construction and is answered without a query.
async function countGuestsInRoom(client: PoolClient, roomKey: string): Promise<number> {
  if (roomKey !== CHYME_MAIN_ROOM_KEY) return 0;
  return countFreshGuests(client);
}

async function countFreshGuests(client: PoolClient, excludingGuestId?: string): Promise<number> {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM chyme_guest_listeners
      WHERE last_seen_at > NOW() - ($1 || ' seconds')::interval
        AND ($2::text IS NULL OR guest_id <> $2)
    `,
    [String(CHYME_PRESENCE_TTL_SECONDS), excludingGuestId ?? null],
  );
  return Number(result.rows[0]?.count ?? 0);
}

// Rows outside the window are dead weight; drop them on the writes so the table stays the size of
// the audience rather than growing with every visitor who ever tapped.
async function pruneExpiredGuests(client: PoolClient): Promise<void> {
  await client.query(
    `DELETE FROM chyme_guest_listeners WHERE last_seen_at < NOW() - ($1 || ' seconds')::interval * 4`,
    [String(CHYME_PRESENCE_TTL_SECONDS)],
  );
}

// Thrown by admitGuestListener when the guest cannot listen right now; the public listen route
// answers with the code and the message so the page can say which it was.
export class ChymeGuestListenError extends Error {
  readonly kind: 'paused' | 'full' | 'not_live';
  constructor(kind: 'paused' | 'full' | 'not_live', message: string) {
    super(message);
    this.name = 'ChymeGuestListenError';
    this.kind = kind;
  }
}

// Let one guest into the listener roster, or say why not. Runs the room-live check, the quota
// policy, and the guest cap in one transaction so two guests tapping at once cannot both take the
// last spot: the roster count and the insert see the same snapshot behind the room row lock.
export async function admitGuestListener(guestId: string): Promise<ChymePublicRoomLiveState> {
  return withDbTransaction(async (client) => {
    const room = await getMainRoomReadOnly(client);
    if (!room) {
      throw new ChymeGuestListenError('not_live', 'No public room is live right now.');
    }
    await client.query(`SELECT id FROM chyme_rooms WHERE id = $1 FOR UPDATE`, [room.id]);
    const [participants, policy] = await Promise.all([listRoomParticipants(client, room.id), readQuotaPolicy(client)]);
    if (participants.length === 0) {
      throw new ChymeGuestListenError('not_live', 'No public room is live right now.');
    }
    if (!policy.guestListenAllowed) {
      throw new ChymeGuestListenError('paused', policy.guestPausedReason ?? 'Listening without an account is paused right now.');
    }
    await pruneExpiredGuests(client);
    const others = await countFreshGuests(client, guestId);
    if (others >= policy.guestCap) {
      throw new ChymeGuestListenError(
        'full',
        `Every listening spot is taken right now (${policy.guestCap} people are listening without an account). Try again in a minute, or sign in to join the room.`,
      );
    }
    await client.query(
      `
        INSERT INTO chyme_guest_listeners (guest_id, joined_at, last_seen_at)
        VALUES ($1, NOW(), NOW())
        ON CONFLICT (guest_id) DO UPDATE SET last_seen_at = NOW()
      `,
      [guestId],
    );
    return {
      roomName: room.room_name,
      roomKey: room.room_key,
      callActive: true,
      participantCount: participants.length,
      guestCount: others + 1,
      policy,
    };
  });
}

// Guest heartbeat: refresh the guest's last_seen_at and credit the gap to the minute meter, the same
// way a member's heartbeat does. A guest with no row (the roster was pruned, or they never tapped)
// is re-admitted through admitGuestListener by the route, not here; this only touches an existing row.
// Returns false when there was no row to touch.
// The keepalive answers with the room's counts as the beat saw them: the listener's line names
// both numbers, and the heartbeat is already a round trip every 35 seconds, so reading them here
// keeps that line current without a second request or a polling loop of its own. `null` means
// there was no roster row to touch — the caller re-admits through the listen route.
export type ChymeGuestPresenceBeat = {
  participantCount: number;
  guestCount: number;
};

export async function touchGuestPresence(guestId: string): Promise<ChymeGuestPresenceBeat | null> {
  return withDbTransaction(async (client) => {
    const result = await client.query<{ credited_seconds: string | null }>(
      `
        UPDATE chyme_guest_listeners AS current
        SET last_seen_at = NOW()
        WHERE guest_id = $1
        RETURNING (
          SELECT CASE
            WHEN NOW() - previous.last_seen_at <= ($2 || ' seconds')::interval
              THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - previous.last_seen_at)))::text
            ELSE '0'
          END
          FROM chyme_guest_listeners AS previous
          WHERE previous.guest_id = $1
        ) AS credited_seconds
      `,
      [guestId, String(CHYME_PRESENCE_TTL_SECONDS)],
    );
    if ((result.rowCount ?? 0) === 0) {
      return null;
    }
    await recordStreamVideoUsage(client, STREAM_VIDEO_SURFACE.chymeGuest, Number(result.rows[0]?.credited_seconds ?? 0));
    const room = await getMainRoomReadOnly(client);
    if (!room) {
      return { participantCount: 0, guestCount: 0 };
    }
    const [participants, guestCount] = await Promise.all([listRoomParticipants(client, room.id), countFreshGuests(client)]);
    return { participantCount: participants.length, guestCount };
  });
}

export async function removeGuestListener(guestId: string): Promise<void> {
  await withDbTransaction(async (client) => {
    await client.query(`DELETE FROM chyme_guest_listeners WHERE guest_id = $1`, [guestId]);
  });
}

// The main room's recent chat for a signed-out visitor (owner directive, 2026-09-18: a visitor can
// read the room chat and signs in to write). Read-only and identity-free: nothing is upserted, and a
// room that no member has ever opened yields an empty list rather than being created here.
export async function listPublicRoomMessages(limit = CHYME_DEFAULT_MESSAGES_LIMIT): Promise<ChymeMessage[]> {
  return withDbTransaction(async (client) => {
    const room = await getMainRoomReadOnly(client);
    if (!room) {
      return [];
    }
    const boundedLimit = Math.min(Math.max(limit, 1), CHYME_DEFAULT_MESSAGES_LIMIT);
    const result = await client.query<MessageRow>(
      `
        SELECT id, user_id, username, avatar_url, text, sent_at
        FROM chyme_messages
        WHERE room_id = $1
        ORDER BY sent_at DESC
        LIMIT $2
      `,
      [room.id, boundedLimit],
    );
    return result.rows.reverse().map(mapMessage);
  });
}

export async function listRoomMessages(
  identity: IdentityInput,
  limit = CHYME_DEFAULT_MESSAGES_LIMIT,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
): Promise<ChymeMessage[]> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await ensureServiceProfile(client, identity);

    const boundedLimit = Math.min(Math.max(limit, 1), CHYME_DEFAULT_MESSAGES_LIMIT);
    const result = await client.query<MessageRow>(
      `
        SELECT id, user_id, username, avatar_url, text, sent_at
        FROM chyme_messages
        WHERE room_id = $1
        ORDER BY sent_at DESC
        LIMIT $2
      `,
      [room.id, boundedLimit],
    );

    return result.rows.reverse().map(mapMessage);
  });
}

export function validateMessageInput(text: string): { valid: true; normalizedText: string } | { valid: false } {
  const normalizedText = sanitizeMessageText(text);
  if (normalizedText.length === 0 || normalizedText.length > CHYME_MAX_MESSAGE_LENGTH) {
    return { valid: false };
  }

  return {
    valid: true,
    normalizedText,
  };
}

export async function sendRoomMessage(
  identity: IdentityInput,
  text: string,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
): Promise<ChymeMessage> {
  const validation = validateMessageInput(text);
  if (!validation.valid) {
    throw new Error('invalid_message_text');
  }

  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await ensureServiceProfile(client, identity);
    await sendChymeStreamMessage({
      userId: identity.userId,
      name: chymeHandle(identity.username, identity.userId),
      text: validation.normalizedText,
      // Fan out to this room's Stream channel (the channel id equals the room key), so the private
      // room's chat never lands in the main room's Stream channel.
      channelId: room.room_key,
    });

    const inserted = await client.query<MessageRow>(
      `
        INSERT INTO chyme_messages (
          room_id,
          user_id,
          username,
          avatar_url,
          text,
          sent_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, user_id, username, avatar_url, text, sent_at
      `,
      [
        room.id,
        identity.userId,
        identity.username,
        identity.avatarUrl,
        validation.normalizedText,
      ],
    );

    return mapMessage(inserted.rows[0]);
  });
}

// Delete one of the member's OWN room chat messages. Author-only: the row is deleted only when its
// user_id matches the caller. The product has no in-place edit — editing IS delete + repost — so the
// client re-uses this: it loads the text back into the composer and deletes the original, and the
// member sends a fresh message. Throws 'message_not_found' (unknown/already gone) or
// 'not_message_owner' (someone else's message) so the route can map them to 404 / 403.
export async function deleteRoomMessage(
  identity: IdentityInput,
  messageId: string,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
): Promise<void> {
  await withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    const existing = await client.query<{ user_id: string }>(
      `SELECT user_id FROM chyme_messages WHERE id = $1 AND room_id = $2 LIMIT 1`,
      [messageId, room.id],
    );
    if (existing.rowCount === 0) {
      throw new Error('message_not_found');
    }
    if (existing.rows[0].user_id !== identity.userId) {
      throw new Error('not_message_owner');
    }
    await client.query(`DELETE FROM chyme_messages WHERE id = $1 AND room_id = $2`, [messageId, room.id]);
  });
}

// Mark the member as in the call. The cap is checked here, under a lock on the room row, so two
// members joining in the same instant cannot both take the last spot; a member already inside the
// presence window is never turned away by their own row (a rejoin after a dropped connection).
// Throws ChymeRoomFullError when the room is at the cap the quota policy sets.
export async function markRoomCallJoined(
  identity: IdentityInput,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
  viewerIsAdmin: boolean = false,
): Promise<ChymeRoomResponse> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await client.query(`SELECT id FROM chyme_rooms WHERE id = $1 FOR UPDATE`, [room.id]);
    await assertNotRemoved(client, room.id, identity.userId);
    const [present, policy] = await Promise.all([listRoomParticipants(client, room.id), readQuotaPolicy(client)]);
    const alreadyIn = present.some((participant) => participant.userId === identity.userId);
    if (!alreadyIn && present.length >= policy.memberCap) {
      throw new ChymeRoomFullError(present.length, policy.memberCap);
    }
    await ensureServiceProfile(client, identity);
    const credited = await upsertMember(client, room.id, identity);
    await recordStreamVideoUsage(client, chymeRoomSurface(roomKey), credited);
    // In hand-raise mode a joiner listens until an admin lets them speak; an admin joins speaking.
    // In open mode the role column is not read, and a fresh row's 'listener' is left as it is.
    if (viewerIsAdmin) {
      await client.query(`UPDATE chyme_room_members SET role = 'speaker' WHERE room_id = $1 AND user_id = $2`, [room.id, identity.userId]);
    }
    const activeRoom = await setRoomCallActive(client, room.id, true);
    const participants = await listRoomParticipants(client, room.id);
    const guestCount = await countGuestsInRoom(client, activeRoom.room_key);

    return toRoomResponse(activeRoom, participants, policy, { userId: identity.userId, isAdmin: viewerIsAdmin }, guestCount);
  });
}

// Heartbeat from the audio room while a member is in the call: refreshes last_seen_at so the
// member keeps counting as present (see listRoomParticipants' freshness window).
export async function touchRoomPresence(
  identity: IdentityInput,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
): Promise<void> {
  await withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await assertNotRemoved(client, room.id, identity.userId);
    const credited = await upsertMember(client, room.id, identity);
    // Each heartbeat is one participant's connected time since the last one; this is the minute
    // meter's only input for members, so it is written here and nowhere else on the member path.
    await recordStreamVideoUsage(client, chymeRoomSurface(roomKey), credited);
  });
}

// Persist a member's raise/lower hand. Unlike a transient Stream reaction, this rides on the
// member's presence row so everyone in the room keeps seeing the raised hand until the member
// lowers it (or leaves / their presence goes stale). last_seen_at is bumped so toggling also
// counts as a heartbeat. If the member has no presence row (not in the call), the UPDATE matches
// nothing and this is a no-op — we still return the current room state for the client.
export async function setRoomMemberHandRaised(
  identity: IdentityInput,
  raised: boolean,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
  viewerIsAdmin: boolean = false,
): Promise<ChymeRoomResponse> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    // The bump to last_seen_at counts as a heartbeat, so the gap it closes is credited to the meter
    // the same way — otherwise the seconds between the last heartbeat and the toggle would be lost.
    const bumped = await client.query<{ credited_seconds: string | null }>(
      `
        UPDATE chyme_room_members AS current
        SET hand_raised = $3, last_seen_at = NOW()
        WHERE room_id = $1 AND user_id = $2
        RETURNING (
          SELECT CASE
            WHEN NOW() - previous.last_seen_at <= ($4 || ' seconds')::interval
              THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - previous.last_seen_at)))::text
            ELSE '0'
          END
          FROM chyme_room_members AS previous
          WHERE previous.room_id = $1 AND previous.user_id = $2
        ) AS credited_seconds
      `,
      [room.id, identity.userId, raised, String(CHYME_PRESENCE_TTL_SECONDS)],
    );
    await recordStreamVideoUsage(client, chymeRoomSurface(roomKey), Number(bumped.rows[0]?.credited_seconds ?? 0));
    const [participants, policy, guestCount] = await Promise.all([
      listRoomParticipants(client, room.id),
      readQuotaPolicy(client),
      countGuestsInRoom(client, room.room_key),
    ]);

    return toRoomResponse(room, participants, policy, { userId: identity.userId, isAdmin: viewerIsAdmin }, guestCount);
  });
}

// Explicit leave: remove the member row so the member stops being counted immediately
// (rather than waiting for the presence window to lapse). Deleting the row also clears any
// raised hand, so a member who left can never linger with a hand up.
export async function leaveRoom(
  identity: IdentityInput,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
): Promise<void> {
  await withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await client.query(
      `DELETE FROM chyme_room_members WHERE room_id = $1 AND user_id = $2`,
      [room.id, identity.userId],
    );
    // The stored flag used to be set on the first join and never cleared. Nothing reads it for
    // "live" (fresh presence is), but a column that only ever goes one way misleads whoever reads
    // the table next; clear it when the last fresh member leaves.
    const remaining = await listRoomParticipants(client, room.id);
    if (remaining.length === 0) {
      await setRoomCallActive(client, room.id, false);
    }
  });
}

export async function markServiceDeletion(userId: string): Promise<ChymeDeletionResponse> {
  const requestedAtIso = await withDbTransaction(async (client) => {
    await client.query(
      `
        UPDATE chyme_service_profiles
        SET status = 'deleted', updated_at = NOW(), deleted_at = NOW()
        WHERE user_id = $1
      `,
      [userId],
    );

    // Remove the member's messages and presence rows from EVERY room (the open main room and the
    // private Weavers room), keyed on user_id alone — deletion must not leave their content behind in
    // a room the old main-room-scoped delete never touched.
    await client.query(`DELETE FROM chyme_messages WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM chyme_room_members WHERE user_id = $1`, [userId]);

    // Back Channel calls hold no history worth keeping, so remove every row this member was part of
    // (as initiator or recipient) — not scoped to the current room. See lib/chyme/back-channel.ts.
    await deleteBackChannelForUser(client, userId);

    const inserted = await client.query<{ requested_at: Date }>(
      `
        INSERT INTO chyme_deletion_events (user_id, scope, service_name, requested_at, status)
        VALUES ($1, 'service', 'chyme', NOW(), 'completed')
        RETURNING requested_at
      `,
      [userId],
    );

    return inserted.rows[0].requested_at.toISOString();
  });

  return {
    ok: true,
    scope: 'service',
    status: 'completed',
    requestedAtIso,
  };
}

export async function markFullAccountDeletionRequested(userId: string): Promise<ChymeDeletionResponse> {
  return withDbTransaction(async (client) => {
    const result = await client.query<DeletionEventRow>(
      `
        INSERT INTO chyme_deletion_events (user_id, scope, service_name, requested_at, status)
        VALUES ($1, 'account', 'all-services', NOW(), 'requested')
        RETURNING id, requested_at
      `,
      [userId],
    );

    const deletionRequest = result.rows[0];
    const requestedAtIso = deletionRequest.requested_at.toISOString();
    await enqueueServiceCreditsDeletionReclaim(client, userId, deletionRequest.id, requestedAtIso);

    return {
      ok: true,
      scope: 'account',
      status: 'requested',
      requestedAtIso,
    };
  });
}
