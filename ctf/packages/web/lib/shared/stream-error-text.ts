// Text of a Stream (GetStream) failure, fit for a response body or a screen (rule 137: say what
// failed and why).
//
// Stream's own messages name the failing call and its reason ("UpdateUsers failed with error: ...",
// "GetOrCreateChannel failed with error: ...") and carry the numeric code a support ticket needs, so
// they are kept entire. Two things are removed: an `api_key=` value, which the Video REST client
// carries in its query string and which some transport errors echo back, and any run past
// MAX_LENGTH, so a runaway body never becomes the entire screen. Never throws.
const MAX_LENGTH = 300;

export function describeStreamError(error: unknown, fallback = 'Stream gave no reason.'): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const text = raw.replace(/api_key=[^&\s"']+/g, 'api_key=[redacted]').trim();
  if (!text) {
    return fallback;
  }
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text;
}

// "<what failed>: <why>" — the shape every failure shown to a member or an admin takes.
export function streamFailureMessage(what: string, error: unknown): string {
  return `${what}: ${describeStreamError(error)}`;
}

// A channel is set up by trying create() and, when that fails (usually because the channel already
// exists), watch(). When both fail the second reason alone is misleading, so this names both.
export function streamChannelSetupFailure(channelId: string, createError: unknown, watchError: unknown): string {
  return `Stream channel "${channelId}" could not be created (${describeStreamError(createError)}) and could not be watched either (${describeStreamError(watchError)})`;
}
