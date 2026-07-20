export const CHYME_PLUGIN_ID = 'chyme';
export const CHYME_MAIN_ROOM_KEY = 'chyme-main-room';
export const CHYME_MAIN_ROOM_NAME = 'Chyme Main Room: Exit the Gauntlet';
export const CHYME_MAX_MESSAGE_LENGTH = 1000;
export const CHYME_DEFAULT_MESSAGES_LIMIT = 100;

// Upper bound on a single Chyme peer tip (ServiceCredits). The route rejects anything above this so a
// member can never submit an unbounded amount; the shared transfer primitive (balance check) is then
// the second guard, not the only one.
export const CHYME_MAX_TIP_AMOUNT = 10000;

// A room member counts as "in the call" only if seen within this window. The audio room
// sends a heartbeat well inside it; a member who leaves or disconnects stops being counted
// once their last_seen_at falls outside it (so a hard disconnect boots them automatically).
export const CHYME_PRESENCE_TTL_SECONDS = 45;

// A Back Channel invite only counts while both members are still in the room. An accepted call is
// separately kept alive by its own heartbeat (below) — leaving the room does not end a live call.
// A pending invite that is not accepted within this window lapses server-side.
export const CHYME_BACK_CHANNEL_INVITE_TTL_SECONDS = 45;
// A live Back Channel call the app stopped heart-beating (both tabs gone) is reaped after this window,
// so a call whose participants both vanished cannot linger as "active" forever.
export const CHYME_BACK_CHANNEL_CALL_TTL_SECONDS = 90;

export const CHYME_ERROR_CODE = {
  invalidPayload: 'CHYME_INVALID_PAYLOAD',
  streamUnavailable: 'CHYME_STREAM_UNAVAILABLE',
  persistenceUnavailable: 'CHYME_PERSISTENCE_UNAVAILABLE',
  internalError: 'CHYME_INTERNAL_ERROR',
  csrfDenied: 'CHYME_CSRF_DENIED',
  // Back Channel specific
  backChannelBlocked: 'CHYME_BACK_CHANNEL_BLOCKED',
  backChannelNotInRoom: 'CHYME_BACK_CHANNEL_NOT_IN_ROOM',
  backChannelNotFound: 'CHYME_BACK_CHANNEL_NOT_FOUND',
  backChannelInvalidState: 'CHYME_BACK_CHANNEL_INVALID_STATE',
} as const;

export type ChymeErrorCode = (typeof CHYME_ERROR_CODE)[keyof typeof CHYME_ERROR_CODE];
