// Account deletion registry — the single source of truth mapping each plugin to the database
// tables that hold a user's data, and how each is handled when that user deletes either (a) just
// that plugin's data ("service" scope) or (b) their whole CTF account ("account" scope).
//
// Built from what actually exists in `ctf/schema.sql` (verified table + column names), NOT from the
// plugin deletion *contracts*, which describe intended/draft schemas that have drifted from the
// shipped tables. Examples of drift this registry deliberately corrects:
//   - `gdp_user_extension` does NOT exist — GDP stores no per-user data, so GDP has nothing to delete.
//   - feed tables key authorship by `author_user_id` / `asked_by_user_id`, not `user_id`.
//   - `socketrelay_requests` uses `owner_user_id`; TrustTransport uses `requester_user_id` /
//     `provider_user_id`; Foundation threads use `created_by_user_id` / `sender_user_id`.
//
// The validator `ctf/scripts/check-deletion-registry.mjs` (wired into CI) checks every table and
// column named here against schema.sql so this file cannot drift from reality again.
//
// Conservative-by-default policy (because deletion is irreversible):
//   - Tables with a clear single user-owner column are deleted (or soft-deleted where a
//     soft-delete column exists).
//   - Money / ledger tables are RETAINED — financial integrity. ServiceCredits is only reclaimed
//     and tombstoned through the existing account-deletion reclaim flow, never hard-deleted here.
//   - Deletion-event and audit-trail tables are RETAINED — they are the accountability record of
//     the deletion itself.
//   - Shared platform content authored by a user but consumed by others (admin announcements,
//     property listings, cohorts, missions) is RETAINED and flagged for product review rather than
//     silently cascaded — see `reviewNote`s. The future Account & Data UI / orchestrator owner
//     decides those policies explicitly.
//   - Global catalog/aggregate tables (currencies, taxonomy, GDP metrics, weekly-performance
//     aggregates) are not listed: they are not any individual user's data.

export type DeletionAction = 'delete' | 'soft-delete' | 'retain';

export type OwnedTable = {
  /** Real table name as it appears in `ctf/schema.sql`. */
  readonly table: string;
  /** Column that scopes a row to a user. Required for every non-`retain` table. */
  readonly userColumn?: string;
  /** How this table is handled on deletion. */
  readonly action: DeletionAction;
  /** Required when `action` is `soft-delete`: the timestamp column to stamp. */
  readonly softDeleteColumn?: string;
  /** Plain-language note for reviewers / audit. */
  readonly note?: string;
  /** Set when a human decision is still needed before this table's handling is final. */
  readonly reviewNote?: string;
};

export type PluginDeletionEntry = {
  readonly slug: string;
  readonly name: string;
  /** One-line, plain-language description for the future Account & Data UI. */
  readonly dataSummary: string;
  /** Whether a user can delete only this plugin's data on its own ("service" scope). */
  readonly serviceScopeSupported: boolean;
  /** Owned tables, ordered child-before-parent so plain deletes respect foreign keys. */
  readonly tables: readonly OwnedTable[];
};

const del = (table: string, userColumn: string, note?: string): OwnedTable => ({
  table,
  userColumn,
  action: 'delete',
  note,
});

const soft = (table: string, userColumn: string, softDeleteColumn: string, note?: string): OwnedTable => ({
  table,
  userColumn,
  action: 'soft-delete',
  softDeleteColumn,
  note,
});

const retain = (table: string, note: string, reviewNote?: string): OwnedTable => ({
  table,
  action: 'retain',
  note,
  reviewNote,
});

export const accountDeletionRegistry: readonly PluginDeletionEntry[] = [
  {
    slug: 'chyme',
    name: 'Chyme',
    dataSummary: 'Your Chyme chat messages and room membership.',
    serviceScopeSupported: true,
    tables: [
      del('chyme_messages', 'user_id', 'Your chat messages.'),
      del('chyme_room_members', 'user_id', 'Your room membership.'),
      soft('chyme_service_profiles', 'user_id', 'deleted_at', 'Your Chyme service profile.'),
      retain('chyme_deletion_events', 'Deletion accountability trail.'),
    ],
  },
  {
    slug: 'directory',
    name: 'Directory',
    dataSummary: 'Your directory profile and its change history.',
    serviceScopeSupported: true,
    tables: [
      del('directory_profile_change_events', 'actor_id', 'History of changes you made to directory profiles.'),
      soft('directory_profiles', 'claimed_by_user_id', 'deleted_at', 'The directory profile you claimed.'),
      soft('directory_user_extension', 'user_id', 'service_deleted_at', 'Your directory plugin extension record.'),
      retain('directory_deletion_events', 'Deletion accountability trail.'),
      // directory_profile_tags is keyed by profile_id (cascades with the profile);
      // directory_announcements are admin-authored.
    ],
  },
  {
    slug: 'feed-announcements',
    name: 'Feed & Announcements',
    dataSummary: 'Your community posts, replies, questions, answers, ratings, and read/dismiss state.',
    serviceScopeSupported: true,
    tables: [
      del('feed_answer_ratings', 'user_id', 'Your ratings on answers.'),
      del('feed_answers', 'author_user_id', 'Your answers.'),
      del('feed_questions', 'asked_by_user_id', 'Your questions.'),
      del('feed_community_replies', 'author_user_id', 'Your replies.'),
      del('feed_community_posts', 'author_user_id', 'Your community posts.'),
      del('feed_user_dismissals', 'user_id', 'Items you dismissed.'),
      del('feed_user_read_state', 'user_id', 'Your read state.'),
      del('feed_membership_events', 'user_id', 'Your feed membership events.'),
      del('announcement_user_state', 'user_id', 'Your announcement read/ack state.'),
      del('announcement_membership_events', 'user_id', 'Your announcement membership events.'),
      // feed_items / announcements / announcement_revisions / announcement_delivery_events are
      // admin-authored platform content (created_by_user_id), retained.
    ],
  },
  {
    slug: 'foundation',
    name: 'Foundation',
    dataSummary: 'Your provider connection threads, messages, calls, quote requests, and notifications.',
    serviceScopeSupported: true,
    tables: [
      del('foundation_notification_events', 'user_id', 'Your Foundation notifications.'),
      del('foundation_rate_limit_counters', 'user_id', 'Your rate-limit counters.'),
      del('foundation_quote_status_events', 'actor_user_id', 'Quote state changes you made.'),
      del('foundation_quote_requests', 'user_id', 'Your quote requests.'),
      del('foundation_message_metadata', 'sender_user_id', 'Metadata for messages you sent.'),
      del('foundation_call_sessions', 'created_by_user_id', 'Call sessions you started.'),
      del('foundation_thread_participants', 'user_id', 'Your participation in connection threads.'),
      del('foundation_connection_threads', 'created_by_user_id', 'Connection threads you started.'),
      soft('foundation_user_extension', 'user_id', 'service_deleted_at', 'Your Foundation plugin extension record.'),
      retain('foundation_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'gross-domestic-product',
    name: 'GDP',
    dataSummary: 'GDP figures are aggregate; no per-user data is stored.',
    serviceScopeSupported: false,
    tables: [
      // No gdp_user_extension exists in schema; all GDP tables are aggregate/admin.
    ],
  },
  {
    slug: 'mood',
    name: 'Mood',
    dataSummary: 'Your mood check-in submissions.',
    serviceScopeSupported: true,
    tables: [
      del('mood_submissions', 'user_id', 'Your mood check-ins.'),
    ],
  },
  {
    slug: 'gentlepulse',
    name: 'GentlePulse',
    dataSummary: 'Your favorited sessions, play history, and ratings.',
    serviceScopeSupported: true,
    tables: [
      del('gentlepulse_ratings', 'user_id', 'Your ratings.'),
      del('gentlepulse_play_events', 'user_id', 'Your play history.'),
      del('gentlepulse_favorites', 'user_id', 'Your favorited sessions.'),
      // gentlepulse_library_items is the shared session library.
    ],
  },
  {
    slug: 'peer-programming',
    name: 'Peer Programming',
    dataSummary: 'Your cohort membership, room messages, feedback, and notifications.',
    serviceScopeSupported: true,
    tables: [
      del('peer_programming_assignment_notifications', 'user_id', 'Your notifications.'),
      del('peer_programming_feedback', 'user_id', 'Feedback you gave.'),
      del('peer_programming_messages', 'author_user_id', 'Your room messages.'),
      del('peer_programming_cohort_members', 'user_id', 'Your cohort membership.'),
      retain('peer_programming_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
      // peer_programming_cohorts / weekly_topics are shared/admin content.
    ],
  },
  {
    slug: 'lighthouse',
    name: 'Lighthouse',
    dataSummary: 'Your Lighthouse profile, extension record, and any property listings you created.',
    serviceScopeSupported: true,
    tables: [
      soft('lighthouse_profiles', 'user_id', 'service_deleted_at', 'Your Lighthouse profile.'),
      soft('lighthouse_user_extension', 'user_id', 'service_deleted_at', 'Your Lighthouse plugin extension record.'),
      retain(
        'lighthouse_properties',
        'Property listings you created.',
        'Listings may be referenced by other users (matches/blocks). Decide whether to delete, transfer, or anonymize before enabling.',
      ),
      retain('lighthouse_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'socketrelay',
    name: 'SocketRelay',
    dataSummary: 'Your relay requests, fulfillments, messages, and profile.',
    serviceScopeSupported: true,
    tables: [
      del('socketrelay_messages', 'sender_user_id', 'Messages you sent.'),
      del('socketrelay_fulfillment_participants', 'user_id', 'Your fulfillment participation.'),
      del('socketrelay_fulfillments', 'requester_user_id', 'Fulfillments you requested.'),
      del('socketrelay_requests', 'owner_user_id', 'Your relay requests.'),
      soft('socketrelay_user_extension', 'user_id', 'service_deleted_at', 'Your SocketRelay plugin extension record.'),
      retain('socketrelay_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'trusttransport',
    name: 'TrustTransport',
    dataSummary: 'Your ride/package requests, offers, trips, ratings, and profile.',
    serviceScopeSupported: true,
    tables: [
      del('trusttransport_ratings', 'requester_user_id', 'Ratings you left.'),
      del('trusttransport_trips', 'requester_user_id', 'Trips you requested.'),
      del('trusttransport_offers', 'provider_user_id', 'Offers you made.'),
      del('trusttransport_requests', 'requester_user_id', 'Your ride/package requests.'),
      soft('trusttransport_user_extension', 'user_id', 'service_deleted_at', 'Your TrustTransport plugin extension record.'),
      retain('trusttransport_earnings_ledger', 'Provider earnings ledger; retained for financial integrity.'),
      retain('trusttransport_payout_requests', 'Payout requests; retained for financial integrity.'),
      retain('trusttransport_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'trust',
    name: 'Trust',
    dataSummary: 'Your Trust extension record.',
    serviceScopeSupported: true,
    tables: [
      del('trust_user_extension', 'user_id', 'Your Trust state/evidence record.'),
      retain('trust_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'workforce',
    name: 'Workforce',
    dataSummary: 'Your workforce profile, recruitment history, and extension record.',
    serviceScopeSupported: true,
    tables: [
      del('workforce_recruited_events', 'user_id', 'Your recruitment history.'),
      del('workforce_profiles', 'user_id', 'Your workforce profile.'),
      soft('workforce_user_extension', 'user_id', 'service_deleted_at', 'Your workforce plugin extension record.'),
      retain('workforce_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
      // workforce_occupations / announcements / export_jobs are admin/shared.
    ],
  },
  {
    slug: 'skills-hunt',
    name: 'Skills Hunt',
    dataSummary: 'Your submissions, achievements, notifications, leaderboard entries, and mission progress.',
    serviceScopeSupported: true,
    tables: [
      del('skills_hunt_notifications', 'user_id', 'Your notifications.'),
      del('skills_hunt_mission_progress', 'user_id', 'Your mission progress.'),
      del('skills_hunt_achievements', 'user_id', 'Your achievements.'),
      del('skills_hunt_leaderboard', 'user_id', 'Your leaderboard entries.'),
      soft('skills_hunt_submissions', 'submitter_user_id', 'deleted_at', 'Your submissions (soft-deleted; audit log retained).'),
      retain('skills_hunt_audit_log', 'Compliance audit log; retained.'),
      // skills_hunt_rounds / missions are global; skills_hunt_directory_profiles are unclaimed projections.
    ],
  },
  {
    slug: 'skills-taxonomy',
    name: 'Skills Taxonomy',
    dataSummary: 'Your taxonomy change history.',
    serviceScopeSupported: true,
    tables: [
      del('skills_taxonomy_change_events', 'actor_id', 'Taxonomy changes you made.'),
      // The taxonomy itself (sectors/job titles/skills) is shared reference data.
    ],
  },
  {
    slug: 'unlock',
    name: 'Unlock',
    dataSummary: 'Your verification submissions.',
    serviceScopeSupported: true,
    tables: [
      del('unlock_verification_submissions', 'user_id', 'Your verification submissions.'),
      retain('unlock_audit_log', 'Access/verification audit log; retained for compliance.'),
      // unlock_runtime_config is global.
    ],
  },
  {
    slug: 'levelup',
    name: 'LevelUp',
    dataSummary: 'Your cohort enrollments.',
    serviceScopeSupported: true,
    tables: [
      del('levelup_enrollments', 'user_id', 'Your cohort enrollments.'),
      del('levelup_rate_limit_counters', 'user_id', 'Your rate-limit counters.'),
      retain('levelup_audit_events', 'Audit log; retained for compliance.'),
      // levelup_cohorts are shared; disbursements/escrows/disputes are money records (retained).
    ],
  },
  {
    slug: 'clicklog',
    name: 'Clicklog',
    dataSummary: 'Your logged incidents.',
    serviceScopeSupported: true,
    tables: [
      del('clicklog_incidents', 'user_id', 'Your logged incidents.'),
    ],
  },
  {
    slug: 'comic',
    name: 'Comic',
    dataSummary: 'Your assistant conversations and answer ratings.',
    serviceScopeSupported: true,
    tables: [
      del('comic_answer_ratings', 'user_id', 'Your answer ratings.'),
      del('comic_conversations', 'user_id', 'Your conversations.'),
      // comic_turns / review_queue / training_examples are shared/admin/model data.
    ],
  },
  {
    slug: 'feedback',
    name: 'Feedback',
    dataSummary: 'Your feedback items and votes.',
    serviceScopeSupported: true,
    tables: [
      del('feedback_votes', 'user_id', 'Your votes.'),
      del('feedback_items', 'user_id', 'Feedback you submitted.'),
      retain('feedback_audit', 'Audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'weekly-performance',
    name: 'Weekly Performance',
    dataSummary: 'Weekly performance figures are aggregate; no per-user data is stored.',
    serviceScopeSupported: false,
    tables: [],
  },
  {
    slug: 'service-credits',
    name: 'ServiceCredits',
    dataSummary: 'Your ServiceCredits wallet, ledger, transfers, and escrow.',
    // Money ledger: not deletable on its own. ServiceCredits is reclaimed/finalized only as part of
    // a full-account deletion, through the existing reclaim outbox + tombstone flow.
    serviceScopeSupported: false,
    tables: [
      retain('service_credits_wallets', 'Money wallet; finalized via reclaim + tombstone on account deletion.'),
      retain('service_credits_ledger_entries', 'Immutable ledger; retained for financial integrity.'),
      retain('service_credits_transfers', 'Immutable transfer record; retained for financial integrity.'),
      retain('service_credits_wallet_tombstones', 'Tombstone marking a finalized wallet.'),
      retain('service_credits_account_deletion_reclaims', 'The reclaim record produced by account deletion.'),
    ],
  },
];

/** Look up a plugin's deletion entry by slug. */
export function getDeletionEntry(slug: string): PluginDeletionEntry | undefined {
  return accountDeletionRegistry.find((entry) => entry.slug === slug);
}

/** All plugin slugs that expose a standalone "delete my data for this plugin" action. */
export function serviceScopedSlugs(): string[] {
  return accountDeletionRegistry
    .filter((entry) => entry.serviceScopeSupported)
    .map((entry) => entry.slug);
}

/** Every real table referenced by the registry, de-duplicated. */
export function allRegisteredTables(): string[] {
  const tables = new Set<string>();
  for (const entry of accountDeletionRegistry) {
    for (const owned of entry.tables) {
      tables.add(owned.table);
    }
  }
  return [...tables];
}
