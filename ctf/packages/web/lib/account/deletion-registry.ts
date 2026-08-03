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

export type DeletionAction = 'delete' | 'soft-delete' | 'pseudonymize' | 'retain';

export type OwnedTable = {
  /** Real table name as it appears in `ctf/schema.sql`. */
  readonly table: string;
  /** Column that scopes a row to a user. Required for every non-`retain` table. */
  readonly userColumn?: string;
  /** How this table is handled on deletion. */
  readonly action: DeletionAction;
  /** Required when `action` is `soft-delete`: the timestamp column to stamp. */
  readonly softDeleteColumn?: string;
  /**
   * Optional for `pseudonymize`: extra columns set to NULL alongside the user column — the
   * denormalized copies of the member's identity (a handle captured at claim time, say), which would
   * otherwise keep naming them after their id is gone.
   */
  readonly clearColumns?: readonly string[];
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

/**
 * The value written over a departed member's id when a row is pseudonymized. A single constant, not a
 * per-user token: a token would still link that person's rows to each other, which is the thing
 * deletion is supposed to end. Two deleted helpers on one request both read as this, and that is
 * correct — they are gone, and telling them apart is not something the surviving party needs.
 */
export const DELETED_MEMBER_PLACEHOLDER = 'deleted_member';

/**
 * Overwrite this member's id on a row that ANOTHER member owns.
 *
 * The case this exists for: a request owner keeps the record that someone offered to help — that row
 * is theirs and deleting it would destroy their data — but the helper's raw Clerk id should not
 * survive their account. Before this, deleting an account left that id sitting in the other party's
 * view forever (owner report: a canceled SocketRelay claim kept naming `user_3FL6…` after the
 * account behind it was gone).
 *
 * Only for genuine member-to-member counterparties. NOT for abuse evidence (a safety report's
 * subject), and NOT for admin/reviewer columns, which are an audit trail — both are retained on
 * purpose; see the notes at their call sites.
 */
const pseudo = (
  table: string,
  userColumn: string,
  clearColumns: readonly string[],
  note?: string,
): OwnedTable => ({
  table,
  userColumn,
  action: 'pseudonymize',
  clearColumns,
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
    slug: 'app-preferences',
    name: 'App preferences',
    dataSummary: 'Your theme and other app-wide display preferences.',
    // Cross-cutting like notifications: not a service a member joins or leaves, so no per-service
    // scope — it clears with the account.
    serviceScopeSupported: false,
    tables: [
      del('user_ui_preferences', 'user_id', 'Your theme and display preferences.'),
    ],
  },
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
      // Both sides of the ephemeral back-channel call log are deleted, not pseudonymized: a call row
      // (invite → active → ended, with ~60s timeouts) has no history surface either party revisits,
      // and the table's no-self CHECK (initiator <> recipient) would be violated the moment BOTH
      // parties of one call delete their accounts and each id collapses to the shared placeholder.
      // ended_by_user_id is always one of the two parties, so these two deletes clear every row
      // that names the member in any column.
      del('chyme_back_channel_calls', 'initiator_user_id', 'Back-channel calls you started.'),
      del('chyme_back_channel_calls', 'recipient_user_id', 'Back-channel calls you received.'),
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
      // Burn-down batch 4: admin content and abuse-prevention trails, retained.
      retain('directory_announcements', 'Admin-authored directory announcements; authorship is the publish audit.'),
      retain('directory_quora_url_history', 'Verification-URL change history; abuse-prevention evidence (detects URL reuse across accounts).'),
      retain('directory_suppressed_quora_urls', 'Admin URL suppression list; abuse prevention and its admin audit.'),
      // directory_profile_skills, directory_profile_tags, and directory_profile_proposed_skills are
      // keyed by profile_id (cascade with the profile, cleared in deleteOwnDirectoryProfile).
    ],
  },
  {
    slug: 'feed-announcements',
    name: 'Feed & Announcements',
    dataSummary: 'Your community posts, replies, questions, answers, ratings, and read/dismiss state.',
    serviceScopeSupported: true,
    tables: [
      del('feed_answer_ratings', 'user_id', 'Your ratings on answers.'),
      del('feed_community_post_reactions', 'user_id', 'Your reactions on community posts.'),
      del('feed_answers', 'author_user_id', 'Your answers.'),
      del('feed_questions', 'asked_by_user_id', 'Your questions.'),
      del('feed_community_replies', 'author_user_id', 'Your replies.'),
      del('feed_community_posts', 'author_user_id', 'Your community posts.'),
      del('feed_commons_notice_seen', 'user_id', 'Which one-time Commons notices you have been shown.'),
      del('feed_user_dismissals', 'user_id', 'Items you dismissed.'),
      del('feed_user_read_state', 'user_id', 'Your read state.'),
      del('feed_membership_events', 'user_id', 'Your feed membership events.'),
      del('announcement_user_state', 'user_id', 'Your announcement read/ack state.'),
      del('announcement_reactions', 'user_id', 'Your reactions on announcements.'),
      del('feed_hub_last_seen', 'user_id', 'When you last opened the Hub (unread-badge state).'),
      del('announcement_membership_events', 'user_id', 'Your announcement membership events.'),
      del('announcement_replies', 'author_user_id', 'Your replies to announcements.'),
      // The AI-answer inference log FK-cascades with the member's questions and answers (deleted
      // above), so this direct delete matches almost nothing — it exists so no log row carrying the
      // member's id can survive through any path the cascades miss.
      del('llm_inference_log', 'actor_user_id', 'AI-answer generation log rows for your questions.'),
      // Burn-down batch 4: admin-authored platform content and its authorship audit, retained — the
      // created_by/updated_by columns record which admin published what, not member data.
      retain('announcements', 'Admin-authored announcements; authorship columns are the publish audit.'),
      retain('announcement_revisions', 'Announcement edit history; admin audit.'),
      retain('announcement_delivery_events', 'Announcement delivery/publish events; admin audit.'),
      retain('feed_items', 'Admin-authored feed content; authorship columns are the publish audit.'),
      retain('feed_render_config', 'Global feed settings and the admin audit of who changed them.'),
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
      // The FK to foundation_user_extension is ON DELETE CASCADE, but the extension row is
      // SOFT-deleted (below), so the cascade never fires — this explicit delete is required.
      del('foundation_provider_accepted_currencies', 'user_id', 'The currencies you accept as a provider.'),
      soft('foundation_user_extension', 'user_id', 'service_deleted_at', 'Your Foundation plugin extension record.'),
      retain('foundation_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
      retain('foundation_capacity_policies', 'Global capacity settings and the admin audit of who changed them.'),
      retain('foundation_capacity_policy_events', 'Capacity-policy change history; admin audit.'),
    ],
  },
  {
    slug: 'gross-domestic-product',
    name: 'GDP',
    dataSummary: 'GDP figures are aggregate; no per-user data is stored.',
    serviceScopeSupported: false,
    tables: [
      // No gdp_user_extension exists in schema; all GDP tables are aggregate/admin.
      retain('gdp_publications', 'Published GDP reports; the host/publisher columns are the publication audit.'),
    ],
  },
  {
    slug: 'mood',
    name: 'Mood',
    dataSummary: 'Your mood check-in submissions.',
    serviceScopeSupported: true,
    tables: [
      // Check-ins are pseudonymous by design: the v3 insert stores user_id as '' on every row and
      // the account link lives only in mood_client_identities, so deleting that mapping cascades the
      // member's check-ins via the pseudonym FK. The direct delete below is defense-in-depth, not a
      // correction: it matches nothing today (no row carries a real id), and exists so that any row
      // that EVER carries one — a legacy import, a future write path that forgets the convention —
      // is cleared with the account instead of surviving as wellbeing data with a name on it. It
      // also makes this table's coverage visible to the deletion-coverage gate, which flags any
      // table with a user_id column that no registry entry names.
      del('mood_submissions', 'user_id', 'Defense-in-depth: any check-in row carrying your raw id (none are written today).'),
      del('mood_client_identities', 'user_id', 'Your pseudonym mapping — removing it cascades every check-in stored under it.'),
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
      retain('peer_programming_cohorts', 'Shared cohorts; assigned_by/ended_by are the admin audit.'),
      retain('peer_programming_settings', 'Global settings and the admin audit of who changed them.'),
      retain('peer_programming_weekly_topics', 'Admin-authored weekly topics; authorship is the publish audit.'),
    ],
  },
  {
    slug: 'lighthouse',
    name: 'Lighthouse',
    dataSummary: 'Your Lighthouse profile, extension record, and any property listings you created.',
    serviceScopeSupported: true,
    tables: [
      del('lighthouse_matches', 'seeker_user_id', 'Stay requests you sent to hosts.'),
      // The other side of the same table, mirroring SocketRelay fulfillments: a stay request sent to
      // your listing is the seeker's record of their own housing search, so the row stays and your
      // id is overwritten.
      pseudo(
        'lighthouse_matches',
        'host_user_id',
        [],
        'Stay requests other members sent to your listings — the record stays with the seeker, your identity does not.',
      ),
      del('lighthouse_blocks', 'blocker_user_id', 'The Lighthouse blocks you created.'),
      // Blocks pointing AT the deleted account are removed, not pseudonymized: the block's purpose
      // (preventing interaction with that account) ends when the account does, a returning person
      // would arrive on a new Clerk id the old row could not catch anyway, and collapsing several
      // blocked ids to the shared placeholder would break the table's UNIQUE (blocker, blocked) the
      // moment one blocker had blocked two departed members. Abuse EVIDENCE lives in
      // member_safety_reports, not here.
      del('lighthouse_blocks', 'blocked_user_id', 'Blocks other members placed on the account being deleted.'),
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
      // The other side of the same table: rows where YOU were the helper belong to the requester, so
      // they stay — but your id and captured handle are overwritten so you are not still named in
      // their Direct Line and admin views after you leave.
      pseudo(
        'socket_relay_fulfillments',
        'fulfiller_user_id',
        ['fulfiller_username'],
        'Requests you offered to help on — the record stays with its owner, your identity does not.',
      ),
      del('socket_relay_requests', 'owner_user_id', 'Your relay requests.'),
      // Lifecycle events belong to the request they narrate (posted/claimed/canceled/closed), which
      // may be another member's surviving record — so the event stays and the actor's id is
      // overwritten, the same shape as the fulfillment pseudonymization above.
      pseudo(
        'socket_relay_request_events',
        'actor_user_id',
        [],
        'Lifecycle events you appear on — the trail stays with the request, your identity does not.',
      ),
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
      // Same shape as SocketRelay: a trip you drove belongs to the rider who requested it, so the
      // row stays and your id is overwritten.
      pseudo(
        'trust_transport_trips',
        'provider_user_id',
        [],
        'Trips you drove or delivered — the record stays with the rider, your identity does not.',
      ),
      del('trust_transport_offers', 'provider_user_id', 'Offers you made.'),
      del('trust_transport_requests', 'requester_user_id', 'Your ride/package requests.'),
      soft('trust_transport_user_extension', 'user_id', 'service_deleted_at', 'Your TrustTransport plugin extension record.'),
      retain('trust_transport_earnings_ledger', 'Provider earnings ledger; retained for financial integrity.'),
      retain('trust_transport_payout_requests', 'Payout requests; retained for financial integrity.'),
      retain('trust_transport_admin_audit_trail', 'Admin action audit log; retained for compliance.'),
      // Burn-down batch 3 (ledger/disputes): disputes over trips/settlement are the accountability
      // record for value that moved between two members — retained like the earnings ledger above.
      retain('trust_transport_disputes', 'Disputes over trips and settlement; retained for ledger integrity and accountability.'),
      // Burn-down batch 4. Status events and proof artifacts belong to the shared trip/request
      // record (which may be the other party's surviving data, and which proofs/disputes rely on),
      // so like the trip's provider side they stay with the id overwritten. Risk signals are abuse
      // evidence; market config is admin-audited settings — both retained with the id intact.
      pseudo(
        'trust_transport_status_events',
        'actor_user_id',
        [],
        'Trip/request lifecycle events you appear on — the trail stays with the record, your identity does not.',
      ),
      pseudo(
        'trust_transport_proof_artifacts',
        'captured_by_user_id',
        [],
        'Pickup/delivery proofs you captured — the evidence stays with the trip, your identity does not.',
      ),
      retain('trust_transport_risk_signals', 'Abuse/risk evidence; retained for safety enforcement.'),
      retain('trust_transport_market_config', 'Global market settings and the admin audit of who changed them.'),
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
      retain('workforce_deletion_events', 'Deletion accountability trail.'),
      retain('workforce_occupations', 'Shared occupation catalog; authorship columns are the admin audit.'),
      retain('workforce_export_jobs', 'Admin report-export jobs; the admin audit of who exported what.'),
      retain('workforce_config', 'Global settings and the admin audit of who changed them.'),
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
      // A report you filed about someone's submission is moderation evidence tied to that
      // submission, not your record — it stays with your id overwritten (resolved_by is the admin
      // audit and is untouched).
      pseudo(
        'skills_hunt_submission_reports',
        'reporter_user_id',
        [],
        'Reports you filed about submissions — the moderation record stays, your identity does not.',
      ),
      retain('skills_hunt_rounds', 'Shared rounds; authorship columns are the admin audit.'),
      retain('skills_hunt_missions', 'Shared missions; authorship columns are the admin audit.'),
      retain('skills_hunt_directory_profiles', 'Admin-generated unclaimed directory projections; created_by is the admin audit.'),
      retain('skills_hunt_feature_reward_card', 'Global reward-card setting and the admin audit of who changed it.'),
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
      retain(
        'unlock_spam_quora_urls',
        'Spam Quora-URL denylist; keyed on the URL (holds no member id), retained for abuse prevention so a URL an admin flagged as spam is not lost when the flagged member deletes their data.',
      ),
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
      // Burn-down batch 3 (ledger/disputes): credit disbursements and the disputes over them are the
      // record of why cohort escrow balances moved — retained for ledger integrity, like the
      // ServiceCredits ledger they feed.
      retain('level_up_disbursements', 'Credit disbursements from cohort escrow; retained for ledger integrity.'),
      retain('level_up_disputes', 'Disputes over cohort milestones/credits; retained for ledger integrity and accountability.'),
      retain('level_up_dispute_comments', 'The dispute conversation record; retained with its dispute.'),
      // Burn-down batch 4: the member-owned leftovers and the shared/admin remainder.
      del('level_up_trainers', 'user_id', 'Your trainer profile (name, headline, bio, tracks).'),
      del('level_up_user_achievements', 'user_id', 'Your achievements.'),
      retain('level_up_cohorts', 'Shared cohorts; created_by is the admin audit.'),
      retain('level_up_cohort_proposals', 'Auto-cohort proposals; decided_by is the admin decision audit.'),
      retain('level_up_milestone_validations', 'Milestone validations — part of why cohort credits were released; ledger-adjacent audit.'),
      retain('level_up_auto_cohort_config', 'Global auto-cohort settings and the admin audit of who changed them.'),
      retain('level_up_auto_cohort_term_overrides', 'Per-term overrides and the admin audit of who set them.'),
    ],
  },
  {
    slug: 'click-log',
    name: 'ClickLog',
    dataSummary: 'Your logged incidents.',
    serviceScopeSupported: true,
    tables: [
      // Child of click_log_incidents by incident_id (no FK), so it deletes first. A suggestion
      // already copied into a private triage issue persists there, like a bug report; the
      // database row and the member link are removed here.
      del('click_log_scheme_suggestions', 'user_id', 'Scheme descriptions you chose to share with the owner.'),
      del('click_log_incidents', 'user_id', 'Your logged incidents.'),
      del('click_log_preferences', 'user_id', 'Your owner-sharing preference.'),
    ],
  },
  {
    slug: 'comic',
    name: 'Comic',
    dataSummary: 'Your assistant conversations, answer ratings, and any writing you contributed.',
    serviceScopeSupported: true,
    tables: [
      del('comic_answer_ratings', 'user_id', 'Your answer ratings.'),
      del('comic_conversations', 'user_id', 'Your conversations.'),
      // Deleting the account deletes the contribution record and, by ON DELETE CASCADE, both every
      // entry held for review under it AND every comic_knowledge_entries row it produced
      // (comic_knowledge_entries.contribution_id). Account deletion must not be a weaker promise
      // than the Withdraw button — and Withdraw only deactivates, so this one actually removes the
      // words. The cascade is a foreign key rather than a step here so it cannot be forgotten.
      del('comic_contributions', 'user_id', 'Writing you contributed to the assistant.'),
      retain('comic_review_queue', 'Answer review queue; reviewer_user_id is the admin review audit.'),
      // comic_turns / training_examples are shared/model data.
    ],
  },
  {
    slug: 'weekly-performance',
    name: 'Weekly Performance',
    dataSummary: 'Weekly performance figures are aggregate; no per-user data is stored.',
    serviceScopeSupported: false,
    tables: [
      retain('weekly_performance_weeks', 'Aggregate week records; selected_by is the admin audit of week selection.'),
    ],
  },
  {
    slug: 'what-works',
    name: 'WhatWorks',
    dataSummary: 'Your endorsements of tools on the shared list.',
    serviceScopeSupported: true,
    tables: [
      del('what_works_endorsements', 'user_id', 'Your endorsements.'),
      // The list itself is community content, not personal data: problems and products are curated
      // entries that other members rely on, and the suggested_by/reviewed_by columns on them are the
      // admin/review audit trail — same retain reasoning as every other reviewer column.
      retain('what_works_problems', 'Curated problem list; community content, not personal data.'),
      retain('what_works_products', 'Curated tool list; suggested_by/reviewed_by retained as review audit.'),
    ],
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
      retain('contributions_cycles', 'Global funding cycles; created_by is the admin audit.'),
      retain('contributions_runtime_config', 'Global settings and the admin audit of who changed them.'),
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
      // Burn-down batch 3 (ledger/disputes): the rest of the credits ledger's supporting records.
      // Everything that documents WHY balances moved is retained for ledger integrity — a deleted
      // account's credits are reclaimed through the tombstone flow above, and the records proving
      // that reclaim (and any dispute over past movements) must survive it.
      retain('service_credits_escrow_holds', 'Escrow holds against the ledger; retained for ledger integrity.'),
      retain('service_credits_disputes', 'Disputes over credit movements; retained for ledger integrity and accountability.'),
      retain('service_credits_dispute_adjustments', 'Admin adjustments resolving disputes; the record of why balances changed.'),
      retain('service_credits_governance_events', 'Governance actions (mints, burns, grants) and their targets; the system-of-record for supply changes.'),
      retain('service_credits_treasury_events', 'Treasury movements; retained for ledger integrity.'),
      retain('service_credits_treasury_config', 'Treasury settings and the admin audit of who changed them.'),
      // Per-member credit-limit settings are current-state config, not ledger history: with the
      // wallet tombstoned there is nothing left for a limit to bound, so the member's row goes
      // rather than keeping a raw id alive in a settings table.
      del('service_credits_credit_limits', 'user_id', 'Your credit-limit settings.'),
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
  {
    slug: 'bug-reports',
    name: 'Bug Reports',
    dataSummary: 'Bug reports you filed (kept for triage with your identity removed).',
    // Cross-cutting: reports reference any plugin, so there is no per-service scope.
    serviceScopeSupported: false,
    tables: [
      // A report is operational triage input the owner still needs after the reporter leaves (it may
      // already be mirrored into a GitHub issue), so the row stays and the reporter's id is
      // overwritten instead of the report being destroyed.
      pseudo(
        'bug_reports',
        'user_id',
        [],
        'Bug reports you filed — the report stays for triage, your identity does not.',
      ),
    ],
  },
  {
    slug: 'platform-account',
    name: 'Account & Moderation',
    dataSummary: 'Cross-cutting account records: sign-in telemetry, deletion accountability, and moderation state.',
    // Platform-level rows, not a service a member joins — they are handled only with the account.
    serviceScopeSupported: false,
    tables: [
      del('login_events', 'user_id', 'Your sign-in timestamps (telemetry, not an enforcement record).'),
      del('admin_area_seen', 'user_id', 'Which admin areas you opened (per-admin new-item badge state).'),
      retain('account_deletion_events', 'The accountability record of the deletion itself.'),
      // Restriction state and its audit are moderation/abuse enforcement: a restricted account's
      // record must survive the account so a delete-and-return does not launder the history. The
      // user_id here is the enforcement key (and the table's primary key), so it is kept intact —
      // the same reasoning as member_blocks.blocked_user_id and the safety-report subject.
      retain('account_restrictions', 'Moderation/restriction state; abuse enforcement record.'),
      retain('account_restrictions_audit', 'The audit trail of restriction decisions; retained for compliance.'),
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
