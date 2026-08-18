// Gated contributor channel — constants shared by server routes and the client shell.
// One admin-owned channel (proposal section 2): no topic rooms, no user-created rooms, no DMs.
// Kept free of server-only imports so client components can read the slug, copy, and limits.

// Channel identity. The Stream channel type is distinct from the Commons ('messaging') so the
// gated feature set (threads, richer reactions, longer messages, uploads OFF) is enforced by
// Stream channel-type config, not just by this app. The type itself is created once by
// ctf/scripts/setupGatedChannelType.mjs.
export const GATED_STREAM_CHANNEL_TYPE = 'ctf-gated';
export const GATED_STREAM_CHANNEL_ID = 'ctf-contributors';

// Slug and label used by the Hub channel list and shell routing.
export const GATED_CHANNEL_SLUG = 'contributors';
export const GATED_CHANNEL_DISPLAY_NAME = '#contributors';

// Moderator read access is DISCLOSED in-channel (proposal hard requirement): this line renders in
// the channel header so the space can never read as an unwatched back-room.
export const GATED_CHANNEL_MODERATOR_DISCLOSURE = 'Moderators can read this channel.';

// Longer messages than the Commons (FEED_MAX_COMMUNITY_POST_LENGTH = 1200).
export const GATED_MAX_MESSAGE_LENGTH = 4000;

// Link cap for the content gate — the same member cap the Commons applies to community posts
// (FEED_MAX_COMMUNITY_POST_URLS = 3). Checked server-side in the channel repository.
export const GATED_MAX_MESSAGE_URLS = 3;

// Posting rate limit — the same threshold the Commons applies to community posts
// (evaluateFeedRateLimit on feed_community_posts: 8 posts per 30 minutes per member).
// Enforced server-side by counting recent rows, exactly like the Commons.
export const GATED_POST_RATE_LIMIT = 8;
export const GATED_POST_RATE_WINDOW_MINUTES = 30;

// Richer reaction set than the Commons' eight (FEED_REACTION_EMOJIS). Fixed list — reactions are
// validated server-side against it. No image upload exists anywhere in this channel (proposal
// hard guardrail: no images in v1).
export const GATED_REACTION_EMOJIS = [
  '👍',
  '❤️',
  '😂',
  '🎉',
  '🙏',
  '😢',
  '💯',
  '🔥',
  '👏',
  '🤝',
  '💡',
  '🌱',
] as const;

export function isGatedReactionEmoji(value: string): boolean {
  return (GATED_REACTION_EMOJIS as readonly string[]).includes(value);
}
