import { StreamClient } from '@stream-io/node-sdk';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';
import { reportError } from 'lib/observability/report';
import { streamFailureMessage } from 'lib/shared/stream-error-text';

// The Stream side of Chyme moderation (owner decision, 2026-09-19): mute a member's microphone in
// the call, remove them from it, and set the call-member role that hand-raise mode enforces.
//
// Every function here answers `{ ok: true }` or `{ ok: false, reason }` and never throws. The
// database row is the record of the admin's decision; the Stream call is where it takes effect.
// A Stream outage is reported to the admin in the route's answer (and to the observability
// channel), not turned into a 500 that undoes the decision.
//
// Hand-raise mode's server-side enforcement reuses the listen-only role the owner configured for
// signed-out guests (`CHYME_GUEST_STREAM_ROLE`, a role on the `default` call type without
// send-audio). A listener is that role on the call; a speaker is the SDK's default `user` role.
// When the env var is unset the role step is skipped and the mode is enforced by the apps alone,
// exactly as guest listen-only was before the role existed.

export type StreamModerationResult = { ok: true } | { ok: false; reason: string };

// Stream call ids accept [0-9a-zA-Z_-]; the apps coerce the room key the same way (toCallIdForChyme).
export function chymeCallIdForRoomKey(roomKey: string): string {
  const cleaned = roomKey.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'chyme-main-room';
}

export function chymeStreamUserId(userId: string): string {
  return `chyme-${userId}`;
}

// The role a listener holds on the call in hand-raise mode, or null when the owner has not set one.
export function chymeListenerStreamRole(): string | null {
  const role = process.env.CHYME_GUEST_STREAM_ROLE?.trim();
  return role && role.length > 0 ? role : null;
}

const CHYME_CALL_TYPE = 'default';

async function withCall<T>(
  roomKey: string,
  op: string,
  action: (call: ReturnType<StreamClient['video']['call']>) => Promise<T>,
): Promise<StreamModerationResult> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return { ok: false, reason: 'Stream is not configured for this environment.' };
  }
  const client = new StreamClient(streamConfig.apiKey, streamConfig.apiSecret, { timeout: 8000 });
  try {
    await action(client.video.call(CHYME_CALL_TYPE, chymeCallIdForRoomKey(roomKey)));
    return { ok: true };
  } catch (error) {
    reportError(error, { area: 'chyme', op, extra: { roomKey } });
    return { ok: false, reason: streamFailureMessage('Stream did not apply the change', error) };
  }
}

// Turn a member's microphone off in the call. They can turn it back on unless their role forbids
// publishing (hand-raise mode with the listener role configured).
export async function muteMemberInCall(roomKey: string, userId: string): Promise<StreamModerationResult> {
  return withCall(roomKey, 'moderation_mute', (call) => call.muteUsers({ user_ids: [chymeStreamUserId(userId)], audio: true }));
}

// Remove a member from the call and keep them out of it. Block rather than kick: a kicked member
// can rejoin at once, and the database row that keeps them out only covers this app's join route.
export async function blockMemberFromCall(roomKey: string, userId: string): Promise<StreamModerationResult> {
  return withCall(roomKey, 'moderation_block', (call) => call.blockUser({ user_id: chymeStreamUserId(userId) }));
}

export async function unblockMemberFromCall(roomKey: string, userId: string): Promise<StreamModerationResult> {
  return withCall(roomKey, 'moderation_unblock', (call) => call.unblockUser({ user_id: chymeStreamUserId(userId) }));
}

// Set a member's role on the call: the listener role (no send-audio) or the default speaker role.
// Skipped, reported as ok, when the owner has not configured a listener role — the apps then
// enforce the mode on their own.
export async function setCallMemberRole(roomKey: string, userId: string, role: 'speaker' | 'listener'): Promise<StreamModerationResult> {
  const listenerRole = chymeListenerStreamRole();
  if (!listenerRole) {
    return { ok: true };
  }
  const streamRole = role === 'listener' ? listenerRole : 'user';
  return withCall(roomKey, 'moderation_role', (call) =>
    call.updateCallMembers({ update_members: [{ user_id: chymeStreamUserId(userId), role: streamRole }] }),
  );
}

// Mute every listed member at once (the switch to hand-raise mode). One Stream call for the lot.
export async function muteMembersInCall(roomKey: string, userIds: string[]): Promise<StreamModerationResult> {
  if (userIds.length === 0) {
    return { ok: true };
  }
  return withCall(roomKey, 'moderation_mute_all', (call) =>
    call.muteUsers({ user_ids: userIds.map(chymeStreamUserId), audio: true }),
  );
}
