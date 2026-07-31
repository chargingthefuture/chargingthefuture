import type { FeedEnabledChannel, FeedItemType } from './types';

export const FEED_PLUGIN_ID = 'feed';
export const ANNOUNCEMENTS_PLUGIN_ID = 'announcements';

export const FEED_ERROR_CODE = {
  invalidPayload: 'FEED_INVALID_PAYLOAD',
  notFound: 'FEED_NOT_FOUND',
  conflict: 'FEED_CONFLICT',
  persistenceUnavailable: 'FEED_PERSISTENCE_UNAVAILABLE',
  csrfDenied: 'FEED_CSRF_DENIED',
  forbidden: 'FEED_FORBIDDEN',
  dismissNotAllowed: 'FEED_DISMISS_NOT_ALLOWED',
  rateLimitExceeded: 'FEED_RATE_LIMIT_EXCEEDED',
  consentRequired: 'FEED_LLM_CONSENT_REQUIRED',
  llmUnavailable: 'FEED_LLM_UNAVAILABLE',
  answerNotFound: 'FEED_ANSWER_NOT_FOUND',
  postNotFound: 'FEED_COMMUNITY_POST_NOT_FOUND',
  moderationRejected: 'FEED_CONTENT_POLICY_VIOLATION',
} as const;

// Moderation states for member-authored Commons content (`feed_community_posts`,
// `feed_community_replies`). The column has existed since those tables were created, defaulting to
// 'accepted', but nothing read it — so a row set to anything else stayed fully visible and the only
// way to take a post down was to delete it. These are the two states the read path now honours:
// 'accepted' is visible, 'hidden' is not. Kept to two on purpose — an admin either leaves a post up
// or takes it down, and a third "under review but still visible" state would be a promise the code
// does not keep.
export const FEED_MODERATION_STATUS = {
  accepted: 'accepted',
  hidden: 'hidden',
} as const;

export type FeedModerationStatus = (typeof FEED_MODERATION_STATUS)[keyof typeof FEED_MODERATION_STATUS];

// Why a post was hidden. A short fixed code, never free text — a moderator's prose about a member
// would become a permanent unreviewable note attached to a survivor's account.
//
// `off_topic` leads because it is the actual day-to-day problem (owner, 2026-07-29): people arrive and
// hold Quora-style discussions with nothing to do with the economy. It is by far the most common
// judgement, so it is the default in the UI and the one a bulk sweep uses.
//
// `suspected_bad_actor` is deliberately worded as *suspected* and carries no automatic consequence —
// it hides the post and nothing else. It never revokes access, flags the account, or feeds any score.
// A hunch recorded as a fact is how a wrong hunch becomes permanent.
export const FEED_MODERATION_REASON = {
  offTopic: 'off_topic',
  suspectedBadActor: 'suspected_bad_actor',
  spam: 'spam',
  abusive: 'abusive',
  other: 'other',
} as const;

export type FeedModerationReason = (typeof FEED_MODERATION_REASON)[keyof typeof FEED_MODERATION_REASON];

export const FEED_MODERATION_REASONS: readonly FeedModerationReason[] = Object.values(FEED_MODERATION_REASON);

// Member-facing wording for each code, used in the admin queue.
export const FEED_MODERATION_REASON_LABEL: Record<FeedModerationReason, string> = {
  off_topic: 'Off topic — not about the economy',
  suspected_bad_actor: 'Suspected bad actor',
  spam: 'Spam',
  abusive: 'Abusive',
  other: 'Other',
};

export function isFeedModerationReason(value: unknown): value is FeedModerationReason {
  return typeof value === 'string' && (FEED_MODERATION_REASONS as readonly string[]).includes(value);
}

// How often the automatic Commons guidance notice goes out, counted in community posts (owner
// decision, 2026-07-30: every 50). Frequent enough that a newcomer meets the rule early, rare enough
// that a regular is not lectured. A reserved actor id owns the notice so it is never attributed to a
// member — including the owner, who should not appear to be personally telling people off every 50
// posts.
export const FEED_COMMONS_GUIDANCE_INTERVAL = 50;

// The "how the public rooms work" notice runs on the same length of rhythm but OFFSET from the purpose
// notice, so the two never land on the same post and a member meets one or the other roughly every 25
// posts rather than both at once. 50 and 75 share a common multiple at 150, where they would collide;
// that is rare enough to be two announcements in a row rather than a problem worth more machinery.
export const FEED_COMMONS_ROOMS_INTERVAL = 75;

// Signal-vs-noise is the owner's standing "every few weeks" reminder, so it is time-shaped rather than
// volume-shaped. Tying it to post count would fire it repeatedly during a busy week and never during a
// quiet one, which is the opposite of a periodic reminder.
export const FEED_COMMONS_SIGNAL_INTERVAL_DAYS = 21;

export const FEED_SYSTEM_ACTOR_ID = 'system:commons-guidance';

export const FEED_DEFAULT_PAGE = 1;
export const FEED_DEFAULT_PAGE_SIZE = 20;
export const FEED_MAX_PAGE_SIZE = 100;

export const FEED_MAX_TITLE_LENGTH = 160;
export const FEED_MAX_BODY_LENGTH = 4000;
export const FEED_MAX_QUESTION_LENGTH = 600;
export const FEED_MAX_COMMUNITY_POST_LENGTH = 1200;
export const FEED_MAX_COMMUNITY_REPLY_LENGTH = 800;

// The number of links (http/https) a community post may contain. Members are capped low to deter
// spam/link-dumping in the publicly-readable Commons; admins get a generous cap so a detailed,
// link-rich welcome or help post from the owner is not blocked. The `<>`-tag block still applies
// to everyone (it prevents raw HTML, not spam).
export const FEED_MAX_COMMUNITY_POST_URLS = 3;
export const FEED_ADMIN_MAX_COMMUNITY_POST_URLS = 20;
// Longer post length for admins — matches the announcement body cap — so the owner can post a full
// welcome/help message in the flow of the chat. Members keep FEED_MAX_COMMUNITY_POST_LENGTH.
export const FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH = 4000;

export const FEED_ALLOWED_CHANNELS = ['announcements', 'questions', 'community'] as const;

// Enabled-channel names are plural ('announcements'); the stored feed_items.item_type is singular
// ('announcement'). The feed timeline filters rows by item_type, so a channel name must be mapped to
// its item_type before it is used in that filter — without this, an 'announcements' channel never
// matches the 'announcement' rows and announcements (and questions) silently vanish from the Commons.
export const FEED_CHANNEL_TO_ITEM_TYPE: Record<FeedEnabledChannel, FeedItemType> = {
  announcements: 'announcement',
  questions: 'question',
  community: 'community',
};
export const FEED_QUESTION_CATEGORIES = ['housing', 'services', 'general', 'safety', 'benefits'] as const;
export const FEED_COMMUNITY_CATEGORIES = ['general', 'peer_support', 'resource_share', 'event'] as const;
export const FEED_ANSWER_RATINGS = ['helpful', 'not_helpful', 'flagged'] as const;

// The fixed quick set of emoji a member can react with on a community post. Shared by server
// and client so both agree; the server rejects any emoji outside this set. Deliberately small —
// this is not a full emoji picker. The display order here is the order reactions render in.
export const FEED_REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '😢', '👋'] as const;

export type FeedReactionEmoji = (typeof FEED_REACTION_EMOJIS)[number];

export function isAllowedFeedReactionEmoji(value: string): value is FeedReactionEmoji {
  return (FEED_REACTION_EMOJIS as readonly string[]).includes(value);
}
