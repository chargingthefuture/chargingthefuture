// Account deletion registry — the single source of truth mapping each plugin to the database
// tables that hold a user's data, and how each is handled when that user deletes either (a) just
// that plugin's data ("service" scope) or (b) their whole CTF account ("account" scope).
//
// Built from what actually exists in `ctf/schema.sql` (verified table + column names), NOT from the
// plugin deletion *contracts*, which describe intended/draft schemas that have drifted from the
// shipped tables. Examples of drift this registry deliberately corrects:
//   - `gdp_user_extension` does NOT exist — GDP stores no per-user data, so GDP has nothing to delete.
//   - feed tables key authorship by `author_user_id` / `asked_by_user_id`, not `user_id`.
//   - `socket_relay_requests` uses `owner_user_id`; TrustTransport uses `requester_user_id` /
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
    slug: 'notifications',
    name: 'Notifications',
    dataSummary: 'Your notifications feed and your device-push preferences.',
    // Notifications are cross-cutting (they reference other plugins), not a standalone service the
    // member can join/leave, so there is no per-service deletion scope — they clear with the account.
    serviceScopeSupported: false,
    tables: [
      del('notifications', 'user_id', 'Your notifications.'),
      del('notification_preferences', 'user_id', 'Your device-push preferences.'),
    ],
  },
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
    slug: 'beacon',
    name: 'Beacon',
    // Beacon stores NO per-member Postgres rows. A member's only Beacon footprint is their live-event
    // chat, which lives in Stream (not the DB) — removed on deletion by the external-cleanup hook
    // (`external-cleanup-registry.ts` → `deleteBeaconStreamData`). The two DB tables are host/admin and
    // accountability records, retained per the Beacon deletion contract.
    dataSummary: 'Beacon keeps no per-member rows; your live-event chat lives only in Stream and is removed on deletion.',
    serviceScopeSupported: false,
    tables: [
      retain(
        'beacon_events',
        'Public broadcast events hosted by an admin (and their recording links) — already posted publicly to the Commons.',
        'Host-account deletion: the orchestrator does not hard-delete public broadcast history; revisit if a host asks to remove/anonymize their past events.',
      ),
      retain('beacon_events_admin_audit_trail', 'Admin-action audit trail (create/go-live/end/moderate/recording-ingest).'),
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
      // directory_profile_skills, directory_profile_tags, and directory_profile_proposed_skills are
      // keyed by profile_id (cascade with the profile, cleared in deleteOwnDirectoryProfile);
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
      // push_subscriptions is a user-global table, but Foundation's instant-call ring (issue #808 task 5)
      // is its only consumer today, so its deletion is wired here. If another plugin ever stores rows in
      // it, move this to a shared/account-level deletion entry so a single-service deletion does not remove
      // a device subscription another service still needs.
      del('push_subscriptions', 'user_id', 'The devices you turned call alerts on for.'),
      del('foundation_notification_events', 'user_id', 'Your Foundation notifications.'),
      del('foundation_rate_limit_counters', 'user_id', 'Your rate-limit counters.'),
      del('foundation_quote_status_events', 'actor_user_id', 'Quote state changes you made.'),
      del('foundation_quote_requests', 'user_id', 'Your quote requests.'),
      del('foundation_message_metadata', 'sender_user_id', 'Metadata for messages you sent.'),
      del('foundation_call_sessions', 'created_by_user_id', 'Call sessions you started.'),
      del('foundation_thread_participants', 'user_id', 'Your participation in connection threads.'),
      del('foundation_connection_threads', 'created_by_user_id', 'Connection threads you started.'),
      del('foundation_provider_skills', 'user_id', 'The skills you opted in to offer.'),
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
      // Mood check-ins are stored pseudonymously: mood_submissions rows carry a
      // pseudonym, not user_id, and the only user link lives in
      // mood_client_identities. Deleting that mapping row cascades all the user's
      // check-ins via the mood_submissions.pseudonym FK (ON DELETE CASCADE), so
      // this single entry removes everything for the user.
      del('mood_client_identities', 'user_id', 'Your mood check-ins (deleting your pseudonym mapping removes every check-in stored under it).'),
    ],
  },
  {
    slug: 'gentle-pulse',
    name: 'GentlePulse',
    dataSummary: 'Your favorited sessions, play history, and ratings.',
    serviceScopeSupported: true,
    tables: [
      del('gentle_pulse_ratings', 'user_id', 'Your ratings.'),
      del('gentle_pulse_play_events', 'user_id', 'Your play history.'),
      del('gentle_pulse_favorites', 'user_id', 'Your favorited sessions.'),
      // gentle_pulse_library_items is the shared session library.
    ],
  },
  {
    slug: 'peer-programming',
    name: 'PeerProgramming',
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
    slug: 'socket-relay',
    name: 'SocketRelay',
    dataSummary: 'Your relay requests, fulfillments, messages, and profile.',
    serviceScopeSupported: true,
    tables: [
      del('socket_relay_messages', 'sender_user_id', 'Messages you sent.'),
      del('socket_relay_fulfillment_participants', 'user_id', 'Your fulfillment participation.'),
      del('socket_relay_fulfillments', 'requester_user_id', 'Fulfillments you requested.'),
      del('socket_relay_requests', 'owner_user_id', 'Your relay requests.'),
      soft('socket_relay_user_extension', 'user_id', 'service_deleted_at', 'Your SocketRelay plugin extension record.'),
      retain('socket_relay_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'trust-transport',
    name: 'TrustTransport',
    dataSummary: 'Your ride/package requests, offers, trips, and profile.',
    serviceScopeSupported: true,
    tables: [
      del('trust_transport_trips', 'requester_user_id', 'Trips you requested.'),
      del('trust_transport_offers', 'provider_user_id', 'Offers you made.'),
      del('trust_transport_requests', 'requester_user_id', 'Your ride/package requests.'),
      soft('trust_transport_user_extension', 'user_id', 'service_deleted_at', 'Your TrustTransport plugin extension record.'),
      retain('trust_transport_earnings_ledger', 'Provider earnings ledger; retained for financial integrity.'),
      retain('trust_transport_payout_requests', 'Payout requests; retained for financial integrity.'),
      retain('trust_transport_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'trust',
    name: 'Trust',
    dataSummary: 'Your Trust extension record.',
    serviceScopeSupported: true,
    tables: [
      del('trust_signal_snapshot', 'user_id', 'Computed trust-signal snapshots derived from your cross-plugin engagement.'),
      del('trust_user_extension', 'user_id', 'Your Trust state/evidence record.'),
      retain('trust_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
    ],
  },
  {
    slug: 'presence',
    name: 'Member Presence',
    dataSummary: 'The cross-plugin index that shows where you are active in other plugins on your Directory profile.',
    serviceScopeSupported: true,
    tables: [
      del('member_plugin_presence', 'user_id', 'Index rows marking your listings/activity across plugins.'),
    ],
  },
  {
    slug: 'member-blocks',
    name: 'Blocked members',
    dataSummary: 'The members you have blocked (your own private list — never shared with anyone).',
    // Cross-cutting member safety control (issue #809). A block is the member's own boundary, so the
    // member may clear their blocks on their own, and they are also removed on full-account deletion.
    // Only the rows this user *created* (blocker_user_id) are their data; rows where someone else
    // blocked this user (blocked_user_id) are that other member's private boundary and are NOT cleared
    // here — when that other member deletes their account, their own blocker rows are removed by this
    // same entry. A leftover reverse-direction row pointing at a deleted user is harmless (the user is
    // gone); cleaning those up is a noted follow-up, not done here, so service-scope deletion never
    // touches another member's blocks.
    //
    // Safety reports (issue #809, task 3) follow the same reporter-owns-their-row rule: a report this
    // member FILED (reporter_user_id) is their own action and is deleted with their account. A report
    // ABOUT this member (reported_user_id) is the ADMIN'S safety evidence raised by another member —
    // it is NOT deleted here, the same way audit/accountability records are retained for compliance.
    // Removing it would erase the owner's record of a predator/trafficker concern and would also let
    // someone delete-and-rejoin to clear reports against them. Reverse-direction reports about a
    // now-deleted account simply point at a gone user, which is harmless evidence.
    serviceScopeSupported: true,
    tables: [
      del('member_safety_reports', 'reporter_user_id', 'Safety reports you filed about another member.'),
      del('member_blocks', 'blocker_user_id', 'The blocks you created.'),
    ],
  },
  {
    slug: 'workforce',
    name: 'Workforce',
    dataSummary: 'Your workforce extension record, plus any leftover rows from the legacy workforce profile/recruitment tables (now unused — the workforce view is read-only over your Directory profile).',
    serviceScopeSupported: true,
    tables: [
      // These two tables are no longer written (the workforce profile is a read-only Directory view
      // and recruited state is derived live), but they are still purged here until they are dropped
      // from the schema in the follow-up so no leftover rows survive an account deletion.
      del('workforce_recruited_events', 'user_id', 'Your recruitment history.'),
      del('workforce_profiles', 'user_id', 'Your workforce profile.'),
      soft('workforce_user_extension', 'user_id', 'service_deleted_at', 'Your workforce plugin extension record.'),
      retain('workforce_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
      // workforce_occupations / announcements / export_jobs are admin/shared.
    ],
  },
  {
    slug: 'skills-hunt',
    name: 'SkillsHunt',
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
    slug: 'level-up',
    name: 'LevelUp',
    dataSummary: 'Your cohort enrollments.',
    serviceScopeSupported: true,
    tables: [
      del('level_up_enrollments', 'user_id', 'Your cohort enrollments.'),
      del('level_up_rate_limit_counters', 'user_id', 'Your rate-limit counters.'),
      retain('level_up_audit_events', 'Audit log; retained for compliance.'),
      // level_up_cohorts are shared; disbursements/escrows/disputes are money records (retained).
    ],
  },
  {
    slug: 'click-log',
    name: 'ClickLog',
    dataSummary: 'Your logged incidents.',
    serviceScopeSupported: true,
    tables: [
      del('click_log_incidents', 'user_id', 'Your logged incidents.'),
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
    slug: 'weekly-performance',
    name: 'Weekly Performance',
    dataSummary: 'Weekly performance figures are aggregate; no per-user data is stored.',
    serviceScopeSupported: false,
    tables: [],
  },
  {
    slug: 'contributions',
    name: 'Contributions',
    dataSummary: 'Your contribution claims (including the Signal contact you provided) and fundraiser banner snooze state.',
    serviceScopeSupported: true,
    tables: [
      del('contributions_submissions', 'user_id', 'Your contribution claims, including the Signal contact you provided.'),
      del('contributions_banner_state', 'user_id', 'Your fundraiser banner snooze state.'),
      retain('contributions_audit_log', 'Audit log; retained for compliance. Contains no Signal contact values.'),
      // contributions_cycles and contributions_runtime_config are global (owner-managed).
      // Granted credits live in the ServiceCredits ledger and follow that plugin's policy below.
    ],
  },
  {
    slug: 'recurring-activity',
    name: 'Recurring Activity',
    dataSummary: 'The ongoing activities you acknowledged with other members (no amounts are stored for fiat; ServiceCredits values are declared figures, never real transfers).',
    // A recurring_activities row is a two-party relationship both members consented to. Neither party
    // can be shown a tie the other has deleted, so removing the whole row on either party's deletion is
    // the privacy-safe default: two entries, one per party column. Not a money ledger — no value moves
    // here and fiat lines carry no amount — so unlike ServiceCredits these rows are hard-deleted.
    serviceScopeSupported: true,
    tables: [
      del('recurring_activities', 'owner_user_id', 'Ongoing activities you recorded.'),
      del('recurring_activities', 'counterparty_user_id', 'Ongoing activities another member recorded with you.'),
      retain('recurring_activity_audit_trail', 'Deletion/accountability trail; retained for compliance.'),
    ],
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
  {
    slug: 'mutual-time',
    name: 'Mutual Time',
    dataSummary: 'Your votes on meeting-time surveys, and any surveys you created as an organizer.',
    // Votes are scheduling metadata, not money or wellbeing data. A survey you created is your own
    // content; deleting it cascade-removes its votes (mutual_time_votes FK ON DELETE CASCADE). Order
    // child-before-parent so a plain delete respects the foreign key.
    serviceScopeSupported: true,
    tables: [
      del('mutual_time_votes', 'voter_user_id', 'Your votes on meeting-time surveys.'),
      del('mutual_time_events', 'created_by_user_id', 'Meeting-time surveys you created.'),
    ],
  },
  {
    slug: 'contributor-access',
    name: 'Contributor Access',
    dataSummary: 'Your contributor-channel messages, reactions, and earned-eligibility record.',
    serviceScopeSupported: false,
    tables: [
      // Deleting the account deletes the earned eligibility row too — by design, deletion resets
      // the barrier (the proposal's answer to a perp who deletes and returns).
      del('contributor_access_channel_post_reactions', 'user_id', 'Your reactions in the contributor channel.'),
      del('contributor_access_channel_posts', 'author_user_id', 'Your messages in the contributor channel.'),
      del('contributor_access_eligibility', 'user_id', 'Your earned-eligibility record.'),
      retain('contributor_access_audit_trail', 'Admin-action accountability trail.'),
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
