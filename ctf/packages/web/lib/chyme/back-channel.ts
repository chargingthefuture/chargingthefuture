import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { withDbTransaction } from 'lib/db/postgres';
import { isBlockedBetween } from 'lib/blocks/repository';
import {
  CHYME_MAIN_ROOM_KEY,
  CHYME_PRESENCE_TTL_SECONDS,
  CHYME_BACK_CHANNEL_INVITE_TTL_SECONDS,
  CHYME_BACK_CHANNEL_CALL_TTL_SECONDS,
  CHYME_ERROR_CODE,
  type ChymeErrorCode,
} from './constants';
import type { ChymeBackChannelState } from './types';

// Back Channel — a free, casual 1:1 audio call between two members who are BOTH currently in the same
// live Chyme room (spec #1746). Everything here is deliberately minimal and private:
//   - consent-gated: an invite must be accepted; declining sends nothing back but {ok:true}
//   - block-aware: a block in either direction hides the action and rejects the invite (403)
//   - room-bound: an invite only lives while both members are in the room; it lapses otherwise
//   - no history, no re-contact, no text — a row exists only to run one call, then it is terminal
//   - no credits anywhere in this module
// A live (accepted) call is NOT ended by leaving the room; it ends on hang-up or when both parties
// stop heart-beating. Nothing here is ever surfaced as Trust evidence or in any public feed (rule 132).

// A typed error the routes map to an error code + HTTP status. Keeps the SQL layer from knowing HTTP.
export class BackChannelError extends Error {
  code: ChymeErrorCode;
  constructor(code: ChymeErrorCode, message: string) {
    super(message);
    this.name = 'BackChannelError';
    this.code = code;
  }
}

type BackChannelRow = {
  id: string;
  room_id: string;
  initiator_user_id: string;
  recipient_user_id: string;
  initiator_username: string | null;
  recipient_username: string | null;
  status: string;
  stream_call_id: string;
  created_at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
  ended_by_user_id: string | null;
  last_heartbeat_at: Date;
};

async function getMainRoomId(client: PoolClient): Promise<string | null> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM chyme_rooms WHERE room_key = $1`,
    [CHYME_MAIN_ROOM_KEY],
  );
  return result.rows[0]?.id ?? null;
}

// Is this member currently "in the room" (fresh presence within the standard window)? A Back Channel
// can only be started with — and an invite only survives between — members who are actually present.
async function isFreshInRoom(client: PoolClient, roomId: string, userId: string): Promise<{ present: boolean; username: string | null }> {
  const result = await client.query<{ username: string | null }>(
    `
      SELECT username
      FROM chyme_room_members
      WHERE room_id = $1
        AND user_id = $2
        AND last_seen_at > NOW() - ($3 || ' seconds')::interval
    `,
    [roomId, userId, String(CHYME_PRESENCE_TTL_SECONDS)],
  );
  return { present: (result.rowCount ?? 0) > 0, username: result.rows[0]?.username ?? null };
}

// Reap stale rows before any read/state computation, so callers never see a "live" call whose people
// are gone. Two rules, both idempotent:
//   1. a pending invite lapses if it has aged out OR either party is no longer fresh in the room
//   2. a live call ends if both apps stopped heart-beating past the call TTL
async function reapStale(client: PoolClient): Promise<void> {
  await client.query(
    `
      UPDATE chyme_back_channel_calls c
      SET status = 'lapsed', ended_at = NOW()
      WHERE c.status = 'inviting'
        AND (
          c.created_at < NOW() - ($1 || ' seconds')::interval
          OR NOT EXISTS (
            SELECT 1 FROM chyme_room_members m
            WHERE m.room_id = c.room_id AND m.user_id = c.initiator_user_id
              AND m.last_seen_at > NOW() - ($2 || ' seconds')::interval
          )
          OR NOT EXISTS (
            SELECT 1 FROM chyme_room_members m
            WHERE m.room_id = c.room_id AND m.user_id = c.recipient_user_id
              AND m.last_seen_at > NOW() - ($2 || ' seconds')::interval
          )
        )
    `,
    [String(CHYME_BACK_CHANNEL_INVITE_TTL_SECONDS), String(CHYME_PRESENCE_TTL_SECONDS)],
  );

  await client.query(
    `
      UPDATE chyme_back_channel_calls
      SET status = 'ended', ended_at = NOW()
      WHERE status = 'active'
        AND last_heartbeat_at < NOW() - ($1 || ' seconds')::interval
    `,
    [String(CHYME_BACK_CHANNEL_CALL_TTL_SECONDS)],
  );
}

// Start a Back Channel: the initiator invites a recipient who is in the same room right now.
export async function inviteBackChannel(
  initiator: { userId: string; username: string | null },
  recipientUserId: string,
): Promise<{ callId: string }> {
  if (!recipientUserId || recipientUserId === initiator.userId) {
    throw new BackChannelError(CHYME_ERROR_CODE.invalidPayload, 'A Back Channel needs a different member.');
  }

  // Block check first (matches the shared member-to-member ordering): a block in either direction
  // means the action was never offered and the invite is rejected outright.
  if (await isBlockedBetween(initiator.userId, recipientUserId)) {
    throw new BackChannelError(CHYME_ERROR_CODE.backChannelBlocked, 'Back Channel is not available with this member.');
  }

  return withDbTransaction(async (client) => {
    await reapStale(client);

    const roomId = await getMainRoomId(client);
    if (!roomId) {
      throw new BackChannelError(CHYME_ERROR_CODE.backChannelNotInRoom, 'The room is not live.');
    }

    const initiatorPresence = await isFreshInRoom(client, roomId, initiator.userId);
    const recipientPresence = await isFreshInRoom(client, roomId, recipientUserId);
    if (!initiatorPresence.present || !recipientPresence.present) {
      throw new BackChannelError(
        CHYME_ERROR_CODE.backChannelNotInRoom,
        'You can only start a Back Channel with someone in the room with you.',
      );
    }

    // If a live invite/call from this initiator to this recipient already exists, return it instead of
    // creating a duplicate (the partial unique index also guards this). Either direction being live is
    // fine to leave alone — one live call per pair per direction.
    const existing = await client.query<BackChannelRow>(
      `
        SELECT id, stream_call_id
        FROM chyme_back_channel_calls
        WHERE initiator_user_id = $1 AND recipient_user_id = $2 AND status IN ('inviting', 'active')
        LIMIT 1
      `,
      [initiator.userId, recipientUserId],
    );
    if (existing.rows[0]) {
      return { callId: existing.rows[0].id };
    }

    const id = randomUUID();
    const streamCallId = `back-channel-${id}`;
    await client.query(
      `
        INSERT INTO chyme_back_channel_calls (
          id, room_id, initiator_user_id, recipient_user_id,
          initiator_username, recipient_username, status, stream_call_id,
          created_at, last_heartbeat_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'inviting', $7, NOW(), NOW())
      `,
      [
        id,
        roomId,
        initiator.userId,
        recipientUserId,
        initiator.username ?? initiatorPresence.username,
        recipientPresence.username,
        streamCallId,
      ],
    );

    return { callId: id };
  });
}

// The poll-driven state for one member: an incoming invite to answer, a pending outgoing invite (the
// "Invite sent…" badge), and/or a live call to show the panel for. Reaps first so nothing shown is stale.
export async function getBackChannelState(userId: string): Promise<ChymeBackChannelState> {
  return withDbTransaction(async (client) => {
    await reapStale(client);

    const incoming = await client.query<BackChannelRow>(
      `
        SELECT id, initiator_user_id, initiator_username
        FROM chyme_back_channel_calls
        WHERE recipient_user_id = $1 AND status = 'inviting'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId],
    );

    const outgoing = await client.query<BackChannelRow>(
      `
        SELECT id, recipient_user_id, recipient_username
        FROM chyme_back_channel_calls
        WHERE initiator_user_id = $1 AND status = 'inviting'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId],
    );

    const active = await client.query<BackChannelRow>(
      `
        SELECT id, stream_call_id, initiator_user_id, recipient_user_id,
               initiator_username, recipient_username, answered_at
        FROM chyme_back_channel_calls
        WHERE (initiator_user_id = $1 OR recipient_user_id = $1) AND status = 'active'
        ORDER BY answered_at DESC NULLS LAST
        LIMIT 1
      `,
      [userId],
    );

    const activeRow = active.rows[0];
    return {
      incomingInvite: incoming.rows[0]
        ? {
          callId: incoming.rows[0].id,
          fromUserId: incoming.rows[0].initiator_user_id,
          fromUsername: incoming.rows[0].initiator_username,
        }
        : null,
      outgoingInvite: outgoing.rows[0]
        ? {
          callId: outgoing.rows[0].id,
          toUserId: outgoing.rows[0].recipient_user_id,
          toUsername: outgoing.rows[0].recipient_username,
        }
        : null,
      activeCall: activeRow
        ? {
          callId: activeRow.id,
          streamCallId: activeRow.stream_call_id,
          role: activeRow.initiator_user_id === userId ? 'initiator' : 'recipient',
          otherUserId: activeRow.initiator_user_id === userId ? activeRow.recipient_user_id : activeRow.initiator_user_id,
          otherUsername: activeRow.initiator_user_id === userId ? activeRow.recipient_username : activeRow.initiator_username,
          startedAtIso: (activeRow.answered_at ?? activeRow.created_at).toISOString(),
        }
        : null,
    };
  });
}

// The recipient accepts: the invite becomes a live call. Returns the row so the route can mint creds.
export async function acceptBackChannel(userId: string, callId: string): Promise<BackChannelRow> {
  return withDbTransaction(async (client) => {
    await reapStale(client);

    const updated = await client.query<BackChannelRow>(
      `
        UPDATE chyme_back_channel_calls
        SET status = 'active', answered_at = NOW(), last_heartbeat_at = NOW()
        WHERE id = $1 AND recipient_user_id = $2 AND status = 'inviting'
        RETURNING id, room_id, initiator_user_id, recipient_user_id, initiator_username,
                  recipient_username, status, stream_call_id, created_at, answered_at,
                  ended_at, ended_by_user_id, last_heartbeat_at
      `,
      [callId, userId],
    );

    const row = updated.rows[0];
    if (!row) {
      // Either not the recipient, or the invite already lapsed/was declined/answered — one clear code.
      throw new BackChannelError(CHYME_ERROR_CODE.backChannelInvalidState, 'This Back Channel invite is no longer available.');
    }
    return row;
  });
}

// The recipient declines. No message is sent to the initiator — the invite just becomes terminal and
// the initiator's "Invite sent…" badge clears on its next poll (the row is no longer 'inviting').
export async function declineBackChannel(userId: string, callId: string): Promise<void> {
  await withDbTransaction(async (client) => {
    const updated = await client.query(
      `
        UPDATE chyme_back_channel_calls
        SET status = 'declined', ended_at = NOW(), ended_by_user_id = $2
        WHERE id = $1 AND recipient_user_id = $2 AND status = 'inviting'
      `,
      [callId, userId],
    );
    if ((updated.rowCount ?? 0) === 0) {
      throw new BackChannelError(CHYME_ERROR_CODE.backChannelNotFound, 'This Back Channel invite is no longer available.');
    }
  });
}

// Either party hangs up (or the initiator cancels a still-pending invite). Terminal.
export async function leaveBackChannel(userId: string, callId: string): Promise<void> {
  await withDbTransaction(async (client) => {
    const updated = await client.query(
      `
        UPDATE chyme_back_channel_calls
        SET status = 'ended', ended_at = NOW(), ended_by_user_id = $2
        WHERE id = $1
          AND (initiator_user_id = $2 OR recipient_user_id = $2)
          AND status IN ('inviting', 'active')
      `,
      [callId, userId],
    );
    if ((updated.rowCount ?? 0) === 0) {
      throw new BackChannelError(CHYME_ERROR_CODE.backChannelNotFound, 'This Back Channel is no longer active.');
    }
  });
}

// Keep a live call alive. Called on an interval by both apps while the call screen/panel is open.
export async function heartbeatBackChannel(userId: string, callId: string): Promise<void> {
  await withDbTransaction(async (client) => {
    const updated = await client.query(
      `
        UPDATE chyme_back_channel_calls
        SET last_heartbeat_at = NOW()
        WHERE id = $1
          AND (initiator_user_id = $2 OR recipient_user_id = $2)
          AND status = 'active'
      `,
      [callId, userId],
    );
    if ((updated.rowCount ?? 0) === 0) {
      throw new BackChannelError(CHYME_ERROR_CODE.backChannelNotFound, 'This Back Channel is no longer active.');
    }
  });
}

// Return a live call the member is part of, so the route can mint join credentials. Used by the
// initiator once their state poll reports the call went active (the recipient got creds from accept).
export async function getBackChannelForJoin(userId: string, callId: string): Promise<BackChannelRow> {
  return withDbTransaction(async (client) => {
    const result = await client.query<BackChannelRow>(
      `
        SELECT id, room_id, initiator_user_id, recipient_user_id, initiator_username,
               recipient_username, status, stream_call_id, created_at, answered_at,
               ended_at, ended_by_user_id, last_heartbeat_at
        FROM chyme_back_channel_calls
        WHERE id = $1 AND (initiator_user_id = $2 OR recipient_user_id = $2) AND status = 'active'
        LIMIT 1
      `,
      [callId, userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new BackChannelError(CHYME_ERROR_CODE.backChannelNotFound, 'This Back Channel is no longer active.');
    }
    return row;
  });
}

// Delete every Back Channel row this member is part of. Called from the Chyme service-deletion and
// full-account-deletion paths so no trace of their calls remains (there is no history to keep).
export async function deleteBackChannelForUser(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `DELETE FROM chyme_back_channel_calls WHERE initiator_user_id = $1 OR recipient_user_id = $1`,
    [userId],
  );
}
