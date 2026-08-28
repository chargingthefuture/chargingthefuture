import { queryDb } from 'lib/db/postgres';
import { TRUST_SNAPSHOT_MODEL } from './constants';
import type {
  TrustEvidenceItem,
  TrustSignalMetrics,
  TrustSignalSnapshot,
  TrustUserExtension,
} from './types';

// The Postgres driver normally parses a JSONB column into a JS array, but a raw-text fallback (some
// driver/pool configs return JSONB as a string) would otherwise reach the client as a string and
// render empty or break serialization. Coerce defensively: parse a string, keep an array, drop
// anything else to an empty list.
function coerceTrustEvidence(value: unknown): TrustEvidenceItem[] {
  if (Array.isArray(value)) {
    return value as TrustEvidenceItem[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as TrustEvidenceItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function getTrustUserExtension(userId: string): Promise<TrustUserExtension> {
  const result = await queryDb<{
    user_id: string;
    trust_evidence: TrustEvidenceItem[];
    updated_at: Date;
  }>(
    `SELECT user_id, trust_evidence, updated_at FROM trust_user_extension WHERE user_id = $1`,
    [userId]
  );
  if (!result.rows.length) {
    return {
      userId,
      trustEvidence: [],
      updatedAt: new Date().toISOString(),
    };
  }
  const row = result.rows[0];
  return {
    userId: row.user_id,
    trustEvidence: coerceTrustEvidence(row.trust_evidence),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Most recent snapshot timestamp for a user, or null if they have never had one. Used to throttle
// the recompute-on-read so the self GET writes at most once per window instead of on every hit.
export async function getLatestTrustSnapshotAt(userId: string): Promise<Date | null> {
  const result = await queryDb<{ created_at: Date }>(
    `SELECT created_at FROM trust_signal_snapshot WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return result.rows.length ? result.rows[0].created_at : null;
}

// === Cross-plugin signal aggregation (real-data-only) =========================================
//
// Trust owns no participation data. It derives a qualitative signal by counting ACTUAL rows in the
// already-seeded upstream plugins. Every query below is a plain COUNT/aggregate over real tables;
// nothing is fabricated, and a member with no upstream rows simply yields zeroes (and therefore no
// evidence — see buildTrustEvidence).
//
// Signals used in the `cross_plugin_engagement_v6` model:
//   - login_events             → how many days the member has signed in on, all-time, plus their
//                                current unbroken run of days (the universal "seen" signal). Signing
//                                in is the whole of it — reading the app without opening a plugin is
//                                still a member turning up, and which plugin they open is not part of
//                                this. Same definition the Weekly Performance dashboard and
//                                PeerProgramming cohort selection read.
//   - socket_relay_*            → completed SocketRelay trades + requests opened
//   - service_credits_*        → completed transfers received + distinct payers; disputes withhold clean-record
//   - lighthouse_matches       → accepted/completed LightHouse matches
//   - trust_transport_trips     → completed TrustTransport trips
//   - skills_hunt_submissions  → accepted SkillsHunt submissions
//   - level_up_enrollments      → completed LevelUp cohorts
//   - chyme_room_members       → Chyme rooms joined
//   - directory_profiles       → claimed Directory profile
//   - what_works_endorsements   → WhatWorks endorsements
//   - peer_programming_cohort_members → PeerProgramming cohorts joined
//   - contributions_submissions→ confirmed contributions
//   - foundation_connection_threads → connections where the member is the PROVIDER (provider side only)
//   - recurring_activities     → distinct members with a CONFIRMED ongoing activity (either side)
// Only coarse COUNTs are read — never amounts, balances, or sensitive per-row detail — and no numeric
// score is produced. Privacy-sensitive personal-wellbeing/verification plugins (ClickLog, Mood,
// Unlock) are deliberately excluded so Trust never exposes what a member is going through;
// their activity is still reflected by the login signal. Foundation surfaces the provider side only —
// the seeker side (requesting services) is help-seeking and is never counted.
function countOf(result: { rows: { count: string }[] }): number {
  return Number(result.rows[0]?.count ?? 0);
}

// Read one named numeric column off the first row, defaulting a missing row/value to 0. Keeps the
// `?.`/`??` guards out of computeTrustSignalMetrics so that function stays flat.
function numCol<T extends Record<string, unknown>>(result: { rows: T[] }, key: keyof T): number {
  const raw = result.rows[0]?.[key];
  return Number(raw ?? 0);
}

// Map the login aggregate rows into their metric fields. Extracted so the login guards don't
// count against computeTrustSignalMetrics' complexity. The streak arrives from its own query
// because it is a windowed read, not an aggregate over the same rows.
function buildLoginMetrics(
  loginAgg: {
    rows: { login_days: string; login_events: string; last_login_at: Date | null }[];
  },
  streakAgg: { rows: { streak_days: string }[] },
): { loginDays: number; loginStreakDays: number; loginEvents: number; lastLoginAt: string | null } {
  const loginRow = loginAgg.rows[0];
  return {
    loginDays: Number(loginRow?.login_days ?? 0),
    loginStreakDays: Number(streakAgg.rows[0]?.streak_days ?? 0),
    loginEvents: Number(loginRow?.login_events ?? 0),
    lastLoginAt: loginRow?.last_login_at ? loginRow.last_login_at.toISOString() : null,
  };
}

export async function computeTrustSignalMetrics(userId: string): Promise<TrustSignalMetrics> {
  const [
    loginAgg,
    loginStreakAgg,
    completedTrades,
    requestsOpened,
    scReceived,
    scDisputes,
    lighthouse,
    trustTransport,
    skillsHunt,
    levelUp,
    chyme,
    directory,
    whatWorks,
    peerProgramming,
    contributions,
    foundation,
    recurringActivity,
  ] = await Promise.all([
    // Signing in is what "seen" means here, exactly as it does on the Weekly Performance dashboard
    // and in PeerProgramming's cohort selection: one definition across the app, and it is a
    // `login_events` row (owner decision, 2026-08-27). The day is bucketed in UTC, matching the
    // streak query below and every other day boundary in the product — this used to be
    // `date_trunc('day', created_at)`, which truncates in the database session's timezone, so on a
    // non-UTC session a member's day count and their streak disagreed about where a day ends.
    queryDb<{ login_days: string; login_events: string; last_login_at: Date | null }>(
      `SELECT
         COUNT(DISTINCT (created_at AT TIME ZONE 'UTC')::date) AS login_days,
         COUNT(*) AS login_events,
         MAX(created_at) AS last_login_at
       FROM login_events
       WHERE user_id = $1`,
      [userId]
    ),
    // The member's CURRENT run of consecutive sign-in days, in UTC. Read separately from the
    // aggregate above because it answers a different question: `login_days` says how much history a
    // member has built up, this says whether they are still around right now — the thing a member
    // needs to know when they are choosing who to ask for help they need soon.
    //
    // How it works: take the distinct UTC days the member signed in, number them newest-first, and
    // add that number to the day. Consecutive days all land on the same value (day 10 + 1, day 9 + 2,
    // day 8 + 3 …), so the run containing the newest day is every row whose value equals
    // `newest day + 1`; the first missed day breaks the sequence and everything older falls out.
    //
    // The final guard is what makes it a CURRENT streak rather than the longest one they ever had:
    // if the newest sign-in day is older than yesterday the count is 0 and no line is shown. Yesterday
    // still counts so a member does not read as gone simply because they have not signed in yet today.
    // A member with no sign-ins at all yields no rows, the subqueries are NULL, and the count is 0.
    queryDb<{ streak_days: string }>(
      `WITH signin_days AS (
         SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS signin_day
         FROM login_events
         WHERE user_id = $1
       ),
       runs AS (
         SELECT signin_day + (ROW_NUMBER() OVER (ORDER BY signin_day DESC))::int AS run_key
         FROM signin_days
       )
       SELECT COUNT(*) AS streak_days
       FROM runs
       WHERE run_key = (SELECT MAX(signin_day) + 1 FROM signin_days)
         AND (SELECT MAX(signin_day) FROM signin_days) >= ((NOW() AT TIME ZONE 'UTC')::date - 1)`,
      [userId]
    ),
    // A "completed trade" is a closed fulfillment in which the member was either the requester or
    // the fulfiller. Closing a fulfillment is how a SocketRelay trade is finished (see
    // socket-relay.repository.closeFulfillment), so a closed row is a genuinely completed exchange.
    queryDb<{ completed: string }>(
      `SELECT COUNT(*) AS completed
       FROM socket_relay_fulfillments
       WHERE status = 'closed'
         AND (requester_user_id = $1 OR fulfiller_user_id = $1)`,
      [userId]
    ),
    queryDb<{ opened: string }>(
      `SELECT COUNT(*) AS opened
       FROM socket_relay_requests
       WHERE owner_user_id = $1`,
      [userId]
    ),
    // Completed ServiceCredits transfers the member received, plus the count of distinct senders.
    // Receiving a credit means another member chose to pay them — a breadth-of-trust signal.
    queryDb<{ completed: string; payers: string }>(
      `SELECT COUNT(*) AS completed, COUNT(DISTINCT sender_user_id) AS payers
       FROM service_credits_transfers
       WHERE recipient_user_id = $1 AND status = 'completed'`,
      [userId]
    ),
    // Disputes opened against the member's received transfers. Used only to withhold the
    // clean-record signal — never turned into a negative badge.
    queryDb<{ disputes: string }>(
      `SELECT COUNT(*) AS disputes
       FROM service_credits_disputes d
       JOIN service_credits_transfers t ON t.id = d.transfer_id
       WHERE t.recipient_user_id = $1`,
      [userId]
    ),
    // Per-plugin participation — one coarse COUNT each, completed/accepted/claimed states only. No
    // sensitive per-row detail; sensitive personal-wellbeing/verification plugins are excluded by design.
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM lighthouse_matches
       WHERE (seeker_user_id = $1 OR host_user_id = $1) AND status IN ('accepted', 'completed')`,
      [userId]
    ),
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM trust_transport_trips
       WHERE (requester_user_id = $1 OR provider_user_id = $1) AND status = 'completed'`,
      [userId]
    ),
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM skills_hunt_submissions WHERE submitter_user_id = $1 AND status = 'accepted'`,
      [userId]
    ),
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM level_up_enrollments WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    ),
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM chyme_room_members WHERE user_id = $1`,
      [userId]
    ),
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM directory_profiles WHERE claimed_by_user_id = $1`,
      [userId]
    ),
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM what_works_endorsements WHERE user_id = $1`,
      [userId]
    ),
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM peer_programming_cohort_members WHERE user_id = $1`,
      [userId]
    ),
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM contributions_submissions WHERE user_id = $1 AND status = 'confirmed'`,
      [userId]
    ),
    // Provider side only: connection threads where the member is the provider (a survivor connected with
    // them). The seeker side is never counted — help-seeking is sensitive.
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM foundation_connection_threads WHERE provider_user_id = $1`,
      [userId]
    ),
    // Distinct OTHER members with a CONFIRMED (active) recurring activity, either side. Distinct
    // counterparties (a UNION de-duplicates the two directions) so one repeated partner — or a ring
    // confirming each other — cannot inflate the breadth signal. No amount, no identity: only the count.
    queryDb<{ count: string }>(
      `SELECT COUNT(*) AS count FROM (
          SELECT counterparty_user_id AS other FROM recurring_activities
            WHERE owner_user_id = $1 AND status = 'active'
          UNION
          SELECT owner_user_id AS other FROM recurring_activities
            WHERE counterparty_user_id = $1 AND status = 'active'
        ) distinct_counterparties`,
      [userId]
    ),
  ]);

  return {
    ...buildLoginMetrics(loginAgg, loginStreakAgg),
    socketRelayCompletedTrades: numCol(completedTrades, 'completed'),
    socketRelayRequestsOpened: numCol(requestsOpened, 'opened'),
    serviceCreditsDistinctPayers: numCol(scReceived, 'payers'),
    serviceCreditsCompletedReceived: numCol(scReceived, 'completed'),
    serviceCreditsDisputesAgainst: numCol(scDisputes, 'disputes'),
    lighthouseMatchesAccepted: countOf(lighthouse),
    trustTransportTripsCompleted: countOf(trustTransport),
    skillsHuntSubmissionsAccepted: countOf(skillsHunt),
    levelUpCohortsCompleted: countOf(levelUp),
    chymeRoomsJoined: countOf(chyme),
    directoryProfilesClaimed: countOf(directory),
    whatWorksEndorsements: countOf(whatWorks),
    peerProgrammingCohortsJoined: countOf(peerProgramming),
    contributionsConfirmed: countOf(contributions),
    foundationConnectionsAsProvider: countOf(foundation),
    recurringActivityCounterparties: countOf(recurringActivity),
  };
}

// Push one "verb N noun" evidence item when the count is positive. The singular/plural choice lives
// in the caller's `summarize` callback so its ternary counts against that callback, not the builder.
function pushCountEvidence(
  evidence: TrustEvidenceItem[],
  nowIso: string,
  count: number,
  type: string,
  summarize: (n: number) => string,
): void {
  if (count > 0) {
    evidence.push({
      type,
      summary: summarize(count),
      createdAt: nowIso,
      createdBy: 'trust-signal',
    });
  }
}

// Clean-record signal: only shown when there are completed received transfers and none have been
// disputed. A dispute withholds this positive signal rather than producing a negative badge —
// signal over noise, with dignity. No number is ranked; this is a categorical "clean / not shown".
function pushCleanRecordEvidence(
  evidence: TrustEvidenceItem[],
  nowIso: string,
  metrics: TrustSignalMetrics,
): void {
  if (metrics.serviceCreditsCompletedReceived > 0 && metrics.serviceCreditsDisputesAgainst === 0) {
    const n = metrics.serviceCreditsCompletedReceived;
    evidence.push({
      type: 'engagement-service-credits-clean',
      summary: `${n} completed ServiceCredits ${n === 1 ? 'transfer' : 'transfers'}, none disputed`,
      createdAt: nowIso,
      createdBy: 'trust-signal',
    });
  }
}

// Sign-in signals — two lines that answer two different questions, which is why neither replaces
// the other:
//   "Active on 162 days"      — how much history the member has here. Cumulative, never resets.
//   "Active 12 days in a row" — whether they are still around. Only present while the run is
//                               unbroken to today or yesterday, so its absence is not a mark
//                               against anyone; it simply says nothing about right now.
//
// The second line exists because the first cannot answer the question a member actually has when
// they need somewhere to stay soon: not just "is this person established" but "will they see my
// message". A long history and a member who stopped signing in months ago look identical on the
// cumulative line alone.
//
// Deliberately plain wording, and no goal, target, or "keep it going" framing anywhere near it: this
// is a fact about the member for someone else to read, not a habit the platform is pushing them to
// keep. The number going back to nothing after a quiet week costs the member nothing.
function pushLoginEvidence(
  evidence: TrustEvidenceItem[],
  nowIso: string,
  metrics: TrustSignalMetrics,
): void {
  if (metrics.loginDays > 0) {
    const n = metrics.loginDays;
    evidence.push({
      type: 'engagement-login-frequency',
      summary: `Active on ${n} ${n === 1 ? 'day' : 'days'}`,
      details: metrics.lastLoginAt ? `Most recent sign-in ${metrics.lastLoginAt}` : undefined,
      createdAt: nowIso,
      createdBy: 'trust-signal',
    });
  }

  if (metrics.loginStreakDays > 0) {
    const n = metrics.loginStreakDays;
    evidence.push({
      type: 'engagement-login-streak',
      summary: `Active ${n} ${n === 1 ? 'day' : 'days'} in a row`,
      createdAt: nowIso,
      createdBy: 'trust-signal',
    });
  }
}

// Per-plugin participation signals. Data-driven so the set can grow without raising complexity; each
// emits one categorical "verb N noun" item only when the real count is > 0.
function pushParticipationEvidence(
  evidence: TrustEvidenceItem[],
  nowIso: string,
  metrics: TrustSignalMetrics,
): void {
  const participationSignals: { count: number; type: string; verb: string; singular: string; plural: string }[] = [
    { count: metrics.lighthouseMatchesAccepted, type: 'engagement-lighthouse-matches', verb: 'Accepted', singular: 'LightHouse match', plural: 'LightHouse matches' },
    { count: metrics.trustTransportTripsCompleted, type: 'engagement-trust-transport-trips', verb: 'Completed', singular: 'TrustTransport trip', plural: 'TrustTransport trips' },
    { count: metrics.skillsHuntSubmissionsAccepted, type: 'engagement-skillshunt-submissions', verb: 'Accepted', singular: 'SkillsHunt submission', plural: 'SkillsHunt submissions' },
    { count: metrics.levelUpCohortsCompleted, type: 'engagement-level-up-cohorts', verb: 'Completed', singular: 'LevelUp cohort', plural: 'LevelUp cohorts' },
    { count: metrics.chymeRoomsJoined, type: 'engagement-chyme-rooms', verb: 'Joined', singular: 'Chyme room', plural: 'Chyme rooms' },
    { count: metrics.directoryProfilesClaimed, type: 'engagement-directory-profile', verb: 'Claimed', singular: 'Directory profile', plural: 'Directory profiles' },
    { count: metrics.whatWorksEndorsements, type: 'engagement-what-works-endorsements', verb: 'Endorsed', singular: 'WhatWorks product', plural: 'WhatWorks products' },
    { count: metrics.peerProgrammingCohortsJoined, type: 'engagement-peerprogramming-cohorts', verb: 'Joined', singular: 'PeerProgramming cohort', plural: 'PeerProgramming cohorts' },
    { count: metrics.contributionsConfirmed, type: 'engagement-contributions', verb: 'Confirmed', singular: 'contribution', plural: 'contributions' },
    { count: metrics.foundationConnectionsAsProvider, type: 'engagement-foundation-provider', verb: 'Connected with', singular: 'member as a Foundation provider', plural: 'members as a Foundation provider' },
    { count: metrics.recurringActivityCounterparties, type: 'engagement-recurring-activity', verb: 'Ongoing activities with', singular: 'community member', plural: 'community members' },
  ];
  for (const signal of participationSignals) {
    if (signal.count > 0) {
      evidence.push({
        type: signal.type,
        summary: `${signal.verb} ${signal.count} ${signal.count === 1 ? signal.singular : signal.plural}`,
        createdAt: nowIso,
        createdBy: 'trust-signal',
      });
    }
  }
}

// Build human-readable, NON-NUMERIC-SCORE evidence from the real metric counts. Real-data-only:
// any signal whose backing rows are absent (count of 0 / no login) produces NO evidence item, so
// the panel never claims activity that did not happen.
export function buildTrustEvidence(metrics: TrustSignalMetrics, nowIso: string): TrustEvidenceItem[] {
  const evidence: TrustEvidenceItem[] = [];

  pushCountEvidence(
    evidence,
    nowIso,
    metrics.socketRelayCompletedTrades,
    'engagement-socket-relay-trades',
    (n) => `Completed ${n} SocketRelay ${n === 1 ? 'trade' : 'trades'}`,
  );

  pushCountEvidence(
    evidence,
    nowIso,
    metrics.socketRelayRequestsOpened,
    'engagement-socket-relay-requests',
    (n) => `Opened ${n} SocketRelay ${n === 1 ? 'request' : 'requests'}`,
  );

  // Breadth signal: distinct members chose to pay this member in ServiceCredits.
  pushCountEvidence(
    evidence,
    nowIso,
    metrics.serviceCreditsDistinctPayers,
    'engagement-service-credits-payers',
    (n) => `Received ServiceCredits from ${n} community ${n === 1 ? 'member' : 'members'}`,
  );

  pushCleanRecordEvidence(evidence, nowIso, metrics);

  pushLoginEvidence(evidence, nowIso, metrics);

  pushParticipationEvidence(evidence, nowIso, metrics);

  return evidence;
}

// Persist one computed snapshot row (append-only) capturing the derived metrics for audit/freshness.
export async function insertTrustSignalSnapshot(
  userId: string,
  metrics: TrustSignalMetrics,
): Promise<TrustSignalSnapshot> {
  const result = await queryDb<{
    id: string;
    user_id: string;
    snapshot: Record<string, unknown>;
    snapshot_type: string;
    created_at: Date;
  }>(
    `INSERT INTO trust_signal_snapshot (user_id, snapshot, snapshot_type)
     VALUES ($1, $2::jsonb, $3)
     RETURNING id, user_id, snapshot, snapshot_type, created_at`,
    [userId, JSON.stringify(metrics), TRUST_SNAPSHOT_MODEL]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    snapshot: row.snapshot,
    snapshotType: row.snapshot_type,
    createdAt: row.created_at.toISOString(),
  };
}

// Replace the user's derived evidence with the freshly computed items and bump updated_at. Upserts
// the extension row so a first-time member gets defaults.
export async function setTrustDerivedEvidence(
  userId: string,
  evidence: TrustEvidenceItem[],
): Promise<TrustUserExtension> {
  const result = await queryDb<{
    user_id: string;
    trust_evidence: TrustEvidenceItem[];
    updated_at: Date;
  }>(
    `INSERT INTO trust_user_extension (user_id, trust_evidence, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET trust_evidence = EXCLUDED.trust_evidence, updated_at = NOW()
     RETURNING user_id, trust_evidence, updated_at`,
    [userId, JSON.stringify(evidence)]
  );
  const row = result.rows[0];
  return {
    userId: row.user_id,
    trustEvidence: coerceTrustEvidence(row.trust_evidence),
    updatedAt: row.updated_at.toISOString(),
  };
}
