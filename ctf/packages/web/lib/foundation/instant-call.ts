import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  FOUNDATION_INSTANT_CALL_RING_LIMIT,
  FOUNDATION_INSTANT_CALL_RING_TIMEOUT_SECONDS,
  FOUNDATION_INSTANT_CALL_RING_WINDOW_SECONDS,
} from './constants';
import { createFoundationCallToken } from './stream';
import type { FoundationInstantCall, FoundationCallRingStatus } from './types';

// Foundation instant 1:1 call ring/answer lifecycle (issue #808 task 3). Audio-only for v1.
//
// State machine (ring_status column on foundation_call_sessions):
//   ringing --answer--> answered (in-call) --end--> ended
//   ringing --decline--> declined (terminal)
//   ringing --timeout(~60s)--> timed_out (terminal)
//   answered --end (either party)--> ended (terminal)
//
// This module deliberately holds NO billing and NO push logic:
//   - Task 4 (billing) hooks the "on answer" moment (see answerInstantCall + the first_block_charged seam).
//   - Task 5 (push) replaces the in-app-only ring delivery (see the seam comment in ringInstantCall).
// It reuses the Direct Line 1:1 thread and the existing participant-only Stream token route; it never
// mints its own token path.

type FoundationCallRow = {
  id: string;
  thread_id: string;
  caller_user_id: string | null;
  callee_user_id: string | null;
  ring_status: string;
  stream_call_id: string;
  ring_expires_at: Date | null;
  answered_at: Date | null;
  ended_at: Date | null;
  ended_by_user_id: string | null;
  first_block_charged: boolean;
  created_at: Date;
};

const CALL_ROW_COLUMNS = `
  id::text,
  thread_id::text,
  caller_user_id,
  callee_user_id,
  ring_status,
  stream_call_id,
  ring_expires_at,
  answered_at,
  ended_at,
  ended_by_user_id,
  first_block_charged,
  created_at
`;

function toIso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapCallRow(row: FoundationCallRow): FoundationInstantCall {
  return {
    id: row.id,
    threadId: row.thread_id,
    callerUserId: row.caller_user_id ?? '',
    calleeUserId: row.callee_user_id ?? '',
    ringStatus: (row.ring_status as FoundationCallRingStatus) ?? 'none',
    streamCallId: row.stream_call_id,
    ringExpiresAtIso: toIso(row.ring_expires_at),
    answeredAtIso: toIso(row.answered_at),
    endedAtIso: toIso(row.ended_at),
    endedByUserId: row.ended_by_user_id,
    firstBlockCharged: Boolean(row.first_block_charged),
    createdAtIso: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

// Resolve the two participants of the thread the caller belongs to, and the channel id, in one query.
// Throws 'thread_not_found' when the caller is not a participant (mirrors getThreadCredentialsForParticipant).
async function loadThreadForCaller(
  client: PoolClient,
  threadId: string,
  callerUserId: string,
): Promise<{ survivorUserId: string; providerUserId: string; streamChannelId: string }> {
  const result = await client.query<{
    survivor_user_id: string;
    provider_user_id: string;
    stream_channel_id: string;
  }>(
    `
      SELECT t.survivor_user_id, t.provider_user_id, t.stream_channel_id
      FROM foundation_connection_threads t
      JOIN foundation_thread_participants p ON p.thread_id = t.id
      WHERE t.id = $1::uuid
        AND p.user_id = $2
      LIMIT 1
    `,
    [threadId, callerUserId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('thread_not_found');
  }
  return {
    survivorUserId: row.survivor_user_id,
    providerUserId: row.provider_user_id,
    streamChannelId: row.stream_channel_id,
  };
}

// Rate-limit how often one member may place a ring, so a member cannot spam a provider with repeated
// incoming calls (issue #808 v1 safety control). Uses the shared foundation_rate_limit_counters window.
async function assertRingRateLimit(client: PoolClient, callerUserId: string): Promise<void> {
  const now = new Date();
  const windowSeconds = FOUNDATION_INSTANT_CALL_RING_WINDOW_SECONDS;
  const windowStartedAt = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);

  const upserted = await client.query<{ request_count: number }>(
    `
      INSERT INTO foundation_rate_limit_counters
        (user_id, command_name, window_started_at, window_seconds, request_count, updated_at)
      VALUES
        ($1, 'foundation.connection.instant-call.ring', $2, $3, 1, NOW())
      ON CONFLICT (user_id, command_name, window_started_at, window_seconds)
      DO UPDATE SET
        request_count = foundation_rate_limit_counters.request_count + 1,
        updated_at = NOW()
      RETURNING request_count
    `,
    [callerUserId, windowStartedAt, windowSeconds],
  );

  const count = Number(upserted.rows[0]?.request_count ?? 0);
  if (count > FOUNDATION_INSTANT_CALL_RING_LIMIT) {
    throw new Error('rate_limit_exceeded');
  }
}

// Lazily expire any of THIS caller/callee pair's rings that are past their ~60s window. Run inside the
// same transaction as a ring/poll so a never-answered ring does not linger. There is no background job;
// the timeout is realised on the next read or write that touches the row.
async function expireStaleRings(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `
      UPDATE foundation_call_sessions
      SET ring_status = 'timed_out', ended_at = NOW(), updated_at = NOW()
      WHERE ring_status = 'ringing'
        AND ring_expires_at IS NOT NULL
        AND ring_expires_at < NOW()
        AND (caller_user_id = $1 OR callee_user_id = $1)
    `,
    [userId],
  );
}

// Place a ring: the caller (a member who tapped "Connect now") rings the provider on an existing Direct
// Line thread. Audio-only -> modality 'voice'. The ring is in-app only for now; the callee learns about it
// by polling getIncomingRing. Returns the created call row in 'ringing' state.
//
// TASK 5 (push notifications) SEAM: this is where a push to the callee's device would be dispatched. v1
// delivers the ring in-app only (the callee's poll). Task 5 should fire a push here after the row is
// committed, reusing the callee_user_id and stream_call_id below — do not change the row shape for it.
export async function ringInstantCall(input: {
  threadId: string;
  callerUserId: string;
}): Promise<FoundationInstantCall> {
  return withDbTransaction(async (client) => {
    await expireStaleRings(client, input.callerUserId);
    await assertRingRateLimit(client, input.callerUserId);

    const thread = await loadThreadForCaller(client, input.threadId, input.callerUserId);
    // The callee is the other participant. A member can ring the provider; the provider could equally ring
    // the survivor. Whoever is NOT the caller is the callee.
    const calleeUserId =
      thread.survivorUserId === input.callerUserId ? thread.providerUserId : thread.survivorUserId;
    if (!calleeUserId || calleeUserId === input.callerUserId) {
      throw new Error('thread_not_found');
    }

    const ringExpiresAt = new Date(Date.now() + FOUNDATION_INSTANT_CALL_RING_TIMEOUT_SECONDS * 1000);
    const streamCallId = `foundation-call-${randomUUID()}`;

    try {
      const inserted = await client.query<FoundationCallRow>(
        `
          INSERT INTO foundation_call_sessions
            (thread_id, created_by_user_id, modality, stream_call_id, requested_duration_minutes,
             status, caller_user_id, callee_user_id, ring_status, ring_expires_at)
          VALUES
            ($1::uuid, $2, 'voice', $3, 0, 'created', $2, $4, 'ringing', $5)
          RETURNING ${CALL_ROW_COLUMNS}
        `,
        [input.threadId, input.callerUserId, streamCallId, calleeUserId, ringExpiresAt],
      );
      return mapCallRow(inserted.rows[0]);
    } catch (error) {
      // The partial unique index foundation_call_sessions_active_ring_per_callee rejects a second live
      // ring to the same callee. Surface that as a clear, retryable conflict.
      const message = error instanceof Error ? error.message : '';
      if (message.includes('foundation_call_sessions_active_ring_per_callee')) {
        throw new Error('callee_busy');
      }
      throw error;
    }
  });
}

// Load a single call the user participates in (caller or callee), expiring it first if its ring lapsed.
async function loadParticipantCall(
  client: PoolClient,
  callId: string,
  userId: string,
): Promise<FoundationCallRow> {
  await expireStaleRings(client, userId);
  const result = await client.query<FoundationCallRow>(
    `
      SELECT ${CALL_ROW_COLUMNS}
      FROM foundation_call_sessions
      WHERE id = $1::uuid
        AND (caller_user_id = $2 OR callee_user_id = $2)
      LIMIT 1
    `,
    [callId, userId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('call_not_found');
  }
  return row;
}

// Read the current state of a call for either participant (drives the caller/callee poll). Realises the
// ring timeout lazily.
export async function getInstantCallState(input: {
  callId: string;
  userId: string;
}): Promise<FoundationInstantCall> {
  return withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.userId);
    return mapCallRow(row);
  });
}

// The callee's incoming-ring inbox: the one live ring (if any) being placed to this user right now. v1
// in-app ring delivery polls this; task 5 (push) will add an out-of-app delivery alongside it.
export async function getIncomingRing(userId: string): Promise<FoundationInstantCall | null> {
  return withDbTransaction(async (client) => {
    await expireStaleRings(client, userId);
    const result = await client.query<FoundationCallRow>(
      `
        SELECT ${CALL_ROW_COLUMNS}
        FROM foundation_call_sessions
        WHERE callee_user_id = $1
          AND ring_status = 'ringing'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId],
    );
    const row = result.rows[0];
    return row ? mapCallRow(row) : null;
  });
}

// Answer a ringing call. Only the callee may answer, and only while it is still ringing. Moves the call to
// 'answered' (the in-call state) and stamps answered_at.
//
// TASK 4 (per-block billing) SEAM: this is the single point where the first per-block charge must be taken
// "on answer". The billing task should, inside this same transaction (so the charge and the answer commit
// together): read the provider's instant_call_rate_credits, debit the caller's ServiceCredits for the
// first block, set first_block_charged = TRUE, and reject the answer (rolling back to 'ringing'/timeout)
// when the caller cannot afford it. v1 leaves first_block_charged FALSE and takes no money.
export async function answerInstantCall(input: {
  callId: string;
  calleeUserId: string;
}): Promise<FoundationInstantCall> {
  return withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.calleeUserId);
    if (row.callee_user_id !== input.calleeUserId) {
      throw new Error('not_callee');
    }
    if (row.ring_status !== 'ringing') {
      throw new Error('not_ringing');
    }

    // --- Task 4 billing hook goes here (charge first block for caller_user_id at the provider's rate,
    //     then set first_block_charged = TRUE in the UPDATE below). v1: no charge. ---

    const updated = await client.query<FoundationCallRow>(
      `
        UPDATE foundation_call_sessions
        SET ring_status = 'answered', status = 'active', answered_at = NOW(), updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING ${CALL_ROW_COLUMNS}
      `,
      [input.callId],
    );
    return mapCallRow(updated.rows[0]);
  });
}

// Decline a ringing call. Only the callee may decline, and only while ringing. Terminal.
export async function declineInstantCall(input: {
  callId: string;
  calleeUserId: string;
}): Promise<FoundationInstantCall> {
  return withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.calleeUserId);
    if (row.callee_user_id !== input.calleeUserId) {
      throw new Error('not_callee');
    }
    if (row.ring_status !== 'ringing') {
      throw new Error('not_ringing');
    }
    const updated = await client.query<FoundationCallRow>(
      `
        UPDATE foundation_call_sessions
        SET ring_status = 'declined', status = 'cancelled', ended_at = NOW(),
            ended_by_user_id = $2, updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING ${CALL_ROW_COLUMNS}
      `,
      [input.callId, input.calleeUserId],
    );
    return mapCallRow(updated.rows[0]);
  });
}

// End a call. Either participant may end it; ends from any non-terminal state (ringing -> caller cancels;
// answered -> either party hangs up). Idempotent: ending an already-ended/declined/timed_out call returns
// the existing terminal row unchanged.
export async function endInstantCall(input: {
  callId: string;
  userId: string;
}): Promise<FoundationInstantCall> {
  return withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.userId);
    const terminal: FoundationCallRingStatus[] = ['declined', 'timed_out', 'ended'];
    if (terminal.includes(row.ring_status as FoundationCallRingStatus)) {
      return mapCallRow(row);
    }
    const updated = await client.query<FoundationCallRow>(
      `
        UPDATE foundation_call_sessions
        SET ring_status = 'ended', status = 'ended', ended_at = NOW(),
            ended_by_user_id = $2, updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING ${CALL_ROW_COLUMNS}
      `,
      [input.callId, input.userId],
    );
    return mapCallRow(updated.rows[0]);
  });
}

// Mint the participant-only Stream audio-join credentials for a call. Reuses the SAME token primitive the
// Direct Line uses (createFoundationCallToken -> createFoundationParticipantToken); there is no parallel
// token path. Caller must already be verified as a participant of the call's thread.
export async function getInstantCallJoinCredentials(input: {
  userId: string;
  displayName: string;
}): Promise<{ streamApiKey: string; streamUserId: string; streamToken: string } | null> {
  const credentials = await createFoundationCallToken({
    userId: input.userId,
    displayName: input.displayName,
  });
  if (!credentials) {
    return null;
  }
  return {
    streamApiKey: credentials.streamApiKey,
    streamUserId: credentials.streamUserId,
    streamToken: credentials.streamToken,
  };
}

// Resolve the Direct Line chat channel id for a call's thread (used so the audio room joins a Stream call
// id derived from the existing thread, keeping one thread per pair). Read-only helper for the join route.
export async function getThreadChannelForCall(input: {
  callId: string;
  userId: string;
}): Promise<{ streamChannelId: string }> {
  const result = await queryDb<{ stream_channel_id: string }>(
    `
      SELECT t.stream_channel_id
      FROM foundation_call_sessions c
      JOIN foundation_connection_threads t ON t.id = c.thread_id
      WHERE c.id = $1::uuid
        AND (c.caller_user_id = $2 OR c.callee_user_id = $2)
      LIMIT 1
    `,
    [input.callId, input.userId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('call_not_found');
  }
  return { streamChannelId: row.stream_channel_id };
}
