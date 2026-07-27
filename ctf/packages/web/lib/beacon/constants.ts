// Stable identifiers and limits for the Beacon plugin (admin-only one-way livestream).
export const BEACON_ERROR_CODE = {
  invalidPayload: 'beacon_invalid_payload',
  invalidJson: 'beacon_invalid_json',
  policyDenied: 'beacon_policy_denied',
  notFound: 'beacon_not_found',
  csrfDenied: 'beacon_csrf_denied',
  persistenceUnavailable: 'beacon_persistence_unavailable',
  streamUnavailable: 'beacon_stream_unavailable',
  conflict: 'beacon_conflict',
  webhookSignatureInvalid: 'beacon_webhook_signature_invalid',
} as const;

// The Stream Video call type Beacon uses. `livestream` gives one publisher (the host) and many
// HLS/WebRTC viewers, which is exactly the one-way broadcast model.
export const BEACON_STREAM_CALL_TYPE = 'livestream';

// The Stream Chat channel type for the live event chat. `livestream` channels are built for a large
// read-heavy audience where only members post, which matches the sign-in-to-chat rule.
export const BEACON_CHAT_CHANNEL_TYPE = 'livestream';

// Brand accent for the Beacon surfaces (amber — a warm "we are on air" signal).
export const BEACON_COLOR = '#B91C1C';

export const BEACON_MAX_TITLE_LENGTH = 160;
export const BEACON_MAX_DESCRIPTION_LENGTH = 2000;

// Slow-mode default cooldown (seconds) when the admin enables it without naming a value.
export const BEACON_DEFAULT_SLOW_MODE_SECONDS = 10;
