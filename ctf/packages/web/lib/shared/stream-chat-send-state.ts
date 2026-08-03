'use client';

// Why a chat message could not be sent, in words a member can act on.
//
// Stream refuses a send with an HTTP 403 in several different situations — the sender is not a member
// of that conversation, the conversation was frozen, the sender was banned, or the app hit a plan
// limit. The chat library collapses every one of them into the same three words on the failed bubble
// ("Message Failed · Unauthorized") and drops Stream's own explanation on the floor, so a member sees
// a dead conversation with no reason and no next step, and the logs carry nothing either (owner
// reports, SocketRelay Direct Line). These helpers read the real reason and keep it — one line for the
// member, the full detail for the log.

// The parts of a Stream API error we read. Stream throws `ErrorFromResponse`, which carries its own
// numeric code and human message alongside the HTTP status; it is narrowed here rather than imported
// so this module stays usable with a loosely typed channel value.
type StreamApiErrorShape = {
  status?: number;
  code?: number;
  message?: string;
  response?: { status?: number; data?: { code?: number; message?: string; StatusCode?: number } };
};

// The two channel fields read here — the capability list and the frozen flag — pulled out of the
// channel value by hand. Stream types `channel.data` as a union that does not always carry them, and
// the value is generically parameterized, so it is taken as `unknown` and narrowed rather than
// described with a shape that would have to be cast at every call site.
function channelData(channel: unknown): Record<string, unknown> | null {
  const data = (channel as { data?: unknown } | null | undefined)?.data;
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

function ownCapabilities(channel: unknown): string[] | null {
  const capabilities = channelData(channel)?.own_capabilities;
  if (!Array.isArray(capabilities)) {
    return null;
  }
  return capabilities.filter((entry): entry is string => typeof entry === 'string');
}

function isFrozen(channel: unknown): boolean {
  return channelData(channel)?.frozen === true;
}

// Stream grants this capability to anyone allowed to post in a channel; it is absent when the member
// is not a member of the channel, is banned, or the channel is frozen.
const SEND_MESSAGE_CAPABILITY = 'send-message';

export type StreamSendFailure = {
  // One line for the member, in plain words.
  memberText: string;
  // Everything worth logging: HTTP status, Stream's numeric code, and Stream's own message.
  detail: Record<string, unknown>;
};

function asStreamError(error: unknown): StreamApiErrorShape {
  return (error ?? {}) as StreamApiErrorShape;
}

// Reads the reason Stream gave, preferring its own message ("channel is frozen", "user is banned from
// channel", ...) because it names the actual cause; falls back to the thrown error's message.
function streamMessageOf(error: StreamApiErrorShape): string | undefined {
  const fromResponse = error.response?.data?.message?.trim();
  if (fromResponse) {
    return fromResponse;
  }
  const fromError = error.message?.trim();
  return fromError && fromError.length > 0 ? fromError : undefined;
}

function statusOf(error: StreamApiErrorShape): number | undefined {
  return error.status ?? error.response?.status ?? error.response?.data?.StatusCode;
}

// Turn a failed send into a member-facing line plus the detail to log. Never throws, and never returns
// an empty line — an unrecognized failure still gets a plain "try again" sentence.
export function describeStreamSendFailure(error: unknown): StreamSendFailure {
  const streamError = asStreamError(error);
  const status = statusOf(streamError);
  const streamMessage = streamMessageOf(streamError);
  const detail = {
    status,
    streamCode: streamError.code ?? streamError.response?.data?.code,
    streamMessage,
  };

  if (status === 403) {
    return {
      // Stream's own message names the cause, so it is shown rather than hidden behind a generic line.
      memberText: streamMessage
        ? `That message was not sent — the chat service refused it: ${streamMessage}`
        : 'That message was not sent — the chat service refused it. Report it with the bug button so it can be fixed.',
      detail,
    };
  }

  if (status === 429) {
    return { memberText: 'That message was not sent — messages are going out too fast. Wait a moment and try again.', detail };
  }

  return {
    memberText: streamMessage
      ? `That message was not sent: ${streamMessage}`
      : 'That message was not sent. Check your connection and try again.',
    detail,
  };
}

// Whether the connected member is allowed to post in this channel, read from the capability list
// Stream returns when the channel is opened. Missing capability data means an older or unexpected
// response shape — treated as allowed, so a read failure here can never take a working composer away.
export function canSendInChannel(channel: unknown): boolean {
  const capabilities = ownCapabilities(channel);
  if (capabilities === null) {
    return true;
  }
  return capabilities.includes(SEND_MESSAGE_CAPABILITY);
}

// The line shown in place of the composer when the member cannot post. Names the frozen case, which is
// the one a member can understand and wait out; anything else is reported as a fault to be looked at,
// with a next step rather than a dead end.
export function describeSendBlock(channel: unknown): string | null {
  if (canSendInChannel(channel)) {
    return null;
  }
  if (isFrozen(channel)) {
    return 'This conversation is paused, so no new messages can be sent. It was paused by a moderator, not by the other person.';
  }
  return 'You can read this conversation but cannot post in it. That is a fault, not a setting — report it with the bug button and it will be looked at.';
}

// The context logged alongside a send block or failure, so the cause is visible without reproducing
// it. Carries no secret: the API key is public by design and only its first characters are kept, which
// is enough to tell which Stream app the browser was talking to.
export function streamChatDebugContext(input: {
  streamApiKey: string;
  streamUserId: string;
  streamChannelId: string;
  channel?: unknown;
}): Record<string, unknown> {
  return {
    streamAppKeyPrefix: input.streamApiKey.slice(0, 6),
    streamUserId: input.streamUserId,
    streamChannelId: input.streamChannelId,
    ownCapabilities: ownCapabilities(input.channel),
    frozen: isFrozen(input.channel),
  };
}
