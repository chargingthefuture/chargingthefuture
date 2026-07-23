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
} from './constants';
import type {
  ChymeDeletionResponse,
  ChymeMessage,
  ChymeParticipant,
  ChymeRoomResponse,
} from './types';
import { withDbTransaction } from 'lib/db/postgres';

type IdentityInput = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
};

type RoomRow = {
  id: string;
  room_key: string;
  room_name: string;
  call_active: boolean;
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
    `SELECT id, room_key, room_name, call_active FROM chyme_rooms WHERE room_key = $1 LIMIT 1`,
    [CHYME_MAIN_ROOM_KEY],
  );
  return result.rows[0] ?? null;
}

// Upsert a Chyme room row by key and return it. Defaults to the open main room; the private
// contributors room passes CHYME_CONTRIBUTORS_ROOM_KEY. The room name is resolved from the known-key
// map, never from caller input, so an arbitrary key can never set an arbitrary display name.
async function ensureRoom(client: PoolClient, roomKey: string = CHYME_MAIN_ROOM_KEY): Promise<RoomRow> {
  const inserted = await client.query<RoomRow>(
    `
      INSERT INTO chyme_rooms (room_key, room_name, call_active)
      VALUES ($1, $2, false)
      ON CONFLICT (room_key)
      DO UPDATE SET room_name = EXCLUDED.room_name
      RETURNING id, room_key, room_name, call_active
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
      RETURNING id, room_key, room_name, call_active
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

async function upsertMember(client: PoolClient, roomId: string, identity: IdentityInput): Promise<void> {
  await client.query(
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
    `,
    [roomId, identity.userId, identity.username, identity.avatarUrl],
  );
}

async function listRoomParticipants(client: PoolClient, roomId: string): Promise<ChymeParticipant[]> {
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
): Promise<ChymeRoomResponse> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await ensureServiceProfile(client, identity);
    // Viewing the room does NOT make you a participant — only joining the call does (see
    // markRoomCallJoined). Otherwise merely opening Chyme would list you on stage forever.
    const participants = await listRoomParticipants(client, room.id);

    return {
      roomId: room.id,
      roomName: room.room_name,
      roomKey: room.room_key,
      // "Live" reflects whether anyone is actually in the call right now (fresh presence),
      // not a stored flag that nothing turns off.
      callActive: participants.length > 0,
      participants,
    };
  });
}

// Public, no-identity view of the one default room's live state. Used by the signed-out guest path
// so a visitor can see whether the room is live and listen in. Unlike getRoomState it does NOT create
// a service profile or otherwise touch the viewer — a guest is not a member.
export async function getPublicRoomLiveState(): Promise<{
  roomName: string;
  roomKey: string;
  callActive: boolean;
  participantCount: number;
}> {
  return withDbTransaction(async (client) => {
    const room = await getMainRoomReadOnly(client);
    if (!room) {
      // Room not created yet (no member has ever opened Chyme): nothing to listen to.
      return { roomName: CHYME_MAIN_ROOM_NAME, roomKey: CHYME_MAIN_ROOM_KEY, callActive: false, participantCount: 0 };
    }
    const participants = await listRoomParticipants(client, room.id);
    return {
      roomName: room.room_name,
      roomKey: room.room_key,
      callActive: participants.length > 0,
      participantCount: participants.length,
    };
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

export async function markRoomCallJoined(
  identity: IdentityInput,
  roomKey: string = CHYME_MAIN_ROOM_KEY,
): Promise<ChymeRoomResponse> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await ensureServiceProfile(client, identity);
    await upsertMember(client, room.id, identity);
    const activeRoom = await setRoomCallActive(client, room.id, true);
    const participants = await listRoomParticipants(client, room.id);

    return {
      roomId: activeRoom.id,
      roomName: activeRoom.room_name,
      roomKey: activeRoom.room_key,
      callActive: participants.length > 0,
      participants,
    };
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
    await upsertMember(client, room.id, identity);
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
): Promise<ChymeRoomResponse> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await client.query(
      `
        UPDATE chyme_room_members
        SET hand_raised = $3, last_seen_at = NOW()
        WHERE room_id = $1 AND user_id = $2
      `,
      [room.id, identity.userId, raised],
    );
    const participants = await listRoomParticipants(client, room.id);

    return {
      roomId: room.id,
      roomName: room.room_name,
      roomKey: room.room_key,
      callActive: participants.length > 0,
      participants,
    };
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
