import type { PoolClient } from 'pg';
import { withDbTransaction, queryDb } from 'lib/db/postgres';
import { CHYME_MAIN_ROOM_KEY, chymeRoomNameForKey, type ChymeSpeakMode } from './constants';
import type { ChymeRole, ChymeRoomRemoval } from './types';
import { ensureRoom, listRoomParticipants, type IdentityInput } from './repository';

// Moderation, the database half (owner decision, 2026-09-19). An admin can mute a member (Stream
// only; nothing stored), remove a member from a room (stored, kept out until lifted), let them
// back in, set a member's role in hand-raise mode, and switch a room's speak mode. The Stream side
// (the call itself) is lib/chyme/stream-moderation.ts; the routes call both and record the action.

export class ChymeModerationError extends Error {
  readonly kind: 'not_in_room' | 'invalid';
  constructor(kind: 'not_in_room' | 'invalid', message: string) {
    super(message);
    this.name = 'ChymeModerationError';
    this.kind = kind;
  }
}

async function requirePresent(client: PoolClient, roomId: string, userId: string): Promise<{ username: string | null }> {
  const present = (await listRoomParticipants(client, roomId)).find((participant) => participant.userId === userId);
  if (!present) {
    throw new ChymeModerationError('not_in_room', 'That member is not in the room right now.');
  }
  return { username: present.username };
}

// Set the room's speak mode. Switching to hand-raise turns everyone present except the admin
// making the switch into a listener, and returns their ids so the route can mute them in the call;
// switching to open leaves the rows alone (the role column is not read in open mode).
export async function setRoomSpeakMode(
  roomKey: string,
  mode: ChymeSpeakMode,
  actor: IdentityInput,
): Promise<{ demotedUserIds: string[] }> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    await client.query(`UPDATE chyme_rooms SET speak_mode = $2, updated_at = NOW() WHERE id = $1`, [room.id, mode]);
    if (mode !== 'hand_raise') {
      return { demotedUserIds: [] };
    }
    const present = await listRoomParticipants(client, room.id);
    const demotedUserIds = present.map((participant) => participant.userId).filter((userId) => userId !== actor.userId);
    await client.query(
      `UPDATE chyme_room_members SET role = CASE WHEN user_id = $2 THEN 'speaker' ELSE 'listener' END WHERE room_id = $1`,
      [room.id, actor.userId],
    );
    return { demotedUserIds };
  });
}

// A member's role in this room ('speaker' may unmute in hand-raise mode; 'listener' may not).
// The member must be present: a role on somebody who is not in the room is a row nobody reads.
export async function setMemberRole(roomKey: string, userId: string, role: ChymeRole): Promise<{ username: string | null }> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    const member = await requirePresent(client, room.id, userId);
    await client.query(`UPDATE chyme_room_members SET role = $3 WHERE room_id = $1 AND user_id = $2`, [room.id, userId, role]);
    return member;
  });
}

// The member's username, for the audit row and the removal record; null when they are not present
// (a removal of somebody who already left still stands — it keeps them out).
async function knownUsername(client: PoolClient, roomId: string, userId: string): Promise<string | null> {
  const result = await client.query<{ username: string | null }>(
    `SELECT username FROM chyme_room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
    [roomId, userId],
  );
  return result.rows[0]?.username ?? null;
}

// Remove a member from the room: their presence row goes (so the count and the stage drop them at
// once) and a removal row keeps them out until an admin lifts it. Re-removing somebody already
// removed refreshes the reason and stands.
export async function removeMemberFromRoom(
  roomKey: string,
  userId: string,
  actor: IdentityInput,
  reason: string | null,
): Promise<{ username: string | null }> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    const username = await knownUsername(client, room.id, userId);
    await client.query(`DELETE FROM chyme_room_members WHERE room_id = $1 AND user_id = $2`, [room.id, userId]);
    await client.query(
      `
        INSERT INTO chyme_room_removals (room_id, user_id, username, removed_by, reason, removed_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (room_id, user_id) WHERE lifted_at IS NULL
        DO UPDATE SET reason = EXCLUDED.reason, removed_by = EXCLUDED.removed_by, removed_at = NOW()
      `,
      [room.id, userId, username, actor.userId, reason],
    );
    return { username };
  });
}

// Let a removed member back in. Returns false when there was no live removal to lift.
export async function liftRoomRemoval(roomKey: string, userId: string, actor: IdentityInput): Promise<boolean> {
  return withDbTransaction(async (client) => {
    const room = await ensureRoom(client, roomKey);
    const result = await client.query(
      `UPDATE chyme_room_removals SET lifted_at = NOW(), lifted_by = $3 WHERE room_id = $1 AND user_id = $2 AND lifted_at IS NULL`,
      [room.id, userId, actor.userId],
    );
    return (result.rowCount ?? 0) > 0;
  });
}

type RemovalRow = {
  id: string;
  room_key: string;
  user_id: string;
  username: string | null;
  removed_by: string;
  reason: string | null;
  removed_at: Date;
};

// Every live removal across both rooms, newest first, for the Chyme admin screen.
export async function listActiveRoomRemovals(): Promise<ChymeRoomRemoval[]> {
  const result = await queryDb<RemovalRow>(
    `
      SELECT r.id, rooms.room_key, r.user_id, r.username, r.removed_by, r.reason, r.removed_at
      FROM chyme_room_removals r
      JOIN chyme_rooms rooms ON rooms.id = r.room_id
      WHERE r.lifted_at IS NULL
      ORDER BY r.removed_at DESC
      LIMIT 200
    `,
  );
  return result.rows.map((row) => ({
    id: row.id,
    roomKey: row.room_key,
    roomName: chymeRoomNameForKey(row.room_key ?? CHYME_MAIN_ROOM_KEY),
    userId: row.user_id,
    username: row.username,
    removedBy: row.removed_by,
    reason: row.reason,
    removedAtIso: row.removed_at.toISOString(),
  }));
}
