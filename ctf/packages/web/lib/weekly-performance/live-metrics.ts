import { queryDb } from 'lib/db/postgres';
import { buildLiveGdpReport } from 'lib/shared/gdp-interface';
import {
  countActiveMembersInWeek,
  countMemberDaysInWeek,
  elapsedDaysInWeek,
} from 'lib/engagement/member-activity';

// Live weekly numbers — rebuilt around the per-plugin value-metric decision record
// (ctf/docs/developer/PLUGIN_VALUE_METRICS.md, owner-locked 2026-07-18).
//
// The dashboard's shape, in card order:
//   1. Two GOAL rows — the two numbers the whole platform is driving toward:
//      GDP Community Value Index (goal: $300B) and Workforce recruited (goal: 2,000,000).
//      Both are STATE metrics (a current total, not a windowed event count), so week-over-week
//      needs memory: each read of the current week upserts the live value into
//      weekly_performance_goal_snapshots, and past weeks report their stored snapshot.
//   2. The per-plugin VALUE EVENTS — each plugin's defining action, the event that means the
//      plugin was used as intended (a completed trip, a hosted stay, a confirmed contribution…).
//      These are windowed on the event's own timestamp, so any week reports its real count.
//   3. Honest ADOPTION rows: how many members are actually turning up — active members (the plain
//      headcount for the week) and daily active members (the average across the week's days) — plus
//      the no-value-to-others plugins the owner wants visible: Directory (findable members), Mood
//      (check-ins + average, aggregate only), ClickLog (aggregate incidents + distinct loggers —
//      never per-member detail).
//
// Dropped from the old set (owner decision): feed counts and LevelUp enrollments-started (intent,
// not delivered value — replaced by completions). Skills Taxonomy carries no dashboard stats at
// all. Sign-in activity is still not VALUE — logging in is not a plugin's defining action — but the
// dashboard has to answer "how many people showed up this week", so the turnout rows are carried as
// adoption (owner report, 2026-08-15). Both read the shared member-day set in
// lib/engagement/member-activity.ts, which counts a member as active on a day when the sign-in
// record holds a row for them that day (owner decision, 2026-08-27).
//
// The Foundation row is an aggregate count on this admin-only surface; per rule 132 the underlying
// participation is sensitive (wellbeing/payment), so it must never appear on a public surface or as
// any per-member figure.
//
// Every query is guarded on table existence and never throws: a missing table or a transient error
// contributes 0 rather than failing the whole dashboard. All table and column names below are fixed
// literals — no user input is interpolated into SQL.

type LiveMetric = {
  metricKey: string;
  metricValue: number;
  metricUnit: string;
  sourcePlugin: string;
};

export const GOAL_METRIC_KEYS = ['goal.gdp_value_index', 'goal.workforce_recruited'] as const;

async function tableExists(table: string): Promise<boolean> {
  const reg = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [`public.${table}`]);
  return !!reg.rows[0]?.reg;
}

// Run a single scalar query (a COUNT / SUM / AVG aliased as `v`) guarded on the existence of every
// table it touches. Returns 0 on a missing table, a NULL result, or any read error.
async function guardedScalar(tables: string | string[], sql: string, weekStart: string): Promise<number> {
  try {
    const needed = Array.isArray(tables) ? tables : [tables];
    for (const table of needed) {
      if (!(await tableExists(table))) return 0;
    }
    const result = await queryDb<{ v: string | null }>(sql, [weekStart]);
    const value = result.rows[0]?.v;
    return value == null ? 0 : Number(value);
  } catch {
    return 0;
  }
}

// Same contract as guardedScalar for a value that comes from a helper module rather than a literal
// query here: a read that fails contributes 0 instead of failing the whole dashboard.
async function safeCount(read: () => Promise<number>): Promise<number> {
  try {
    return await read();
  } catch {
    return 0;
  }
}

// The week window is [weekStart, weekStart + 7 days). Counting on each row's own event timestamp
// anchors every number to the week the value was actually delivered in.

// COUNT(*) of a table's rows whose date column falls in the week window, with an optional fixed filter.
function windowCount(table: string, dateColumn: string, filter = ''): (weekStart: string) => Promise<number> {
  const extra = filter ? `AND ${filter}` : '';
  return (weekStart: string) =>
    guardedScalar(
      table,
      `SELECT COUNT(*)::text AS v FROM ${table}
       WHERE ${dateColumn} >= $1::date AND ${dateColumn} < $1::date + INTERVAL '7 days' ${extra}`,
      weekStart,
    );
}

// ── Value events ───────────────────────────────────────────────────────────────

// Foundation: an answered, charged 1:1 call — the only Foundation signal (messages are too easy to
// game; quote completion is not tracked as an event). Aggregate count only, admin surface only.
const foundationCallsAnswered = (weekStart: string) =>
  guardedScalar(
    'foundation_call_sessions',
    `SELECT COUNT(*)::text AS v FROM foundation_call_sessions
     WHERE answered_at >= $1::date AND answered_at < $1::date + INTERVAL '7 days'
       AND blocks_charged > 0`,
    weekStart,
  );

// TrustTransport: a trip both sides confirmed complete.
const trustTransportTripsCompleted = windowCount(
  'trust_transport_trips',
  'completed_at',
  `status = 'completed' AND requester_completion_confirmed_at IS NOT NULL AND provider_completion_confirmed_at IS NOT NULL`,
);

// Lighthouse: a completed stay. The table has no completed_at column, so the window keys on
// updated_at of rows now in 'completed' — the status flip is the last write in the normal flow.
const lighthouseStaysCompleted = windowCount('lighthouse_matches', 'updated_at', `status = 'completed'`);

// SocketRelay: a request the requester closed as successful. No closed_at column; updated_at is
// written by the close, so it anchors the week.
const socketRelayFulfilled = windowCount(
  'socket_relay_fulfillments',
  'updated_at',
  `close_reason = 'successful'`,
);

// Chyme: a peer tip (a completed ServiceCredits transfer originated by Chyme, never self-to-self).
const chymeTips = windowCount(
  'service_credits_transfers',
  'completed_at',
  `status = 'completed' AND origin_plugin = 'chyme' AND sender_user_id <> recipient_user_id`,
);

// ServiceCredits: a completed DIRECT peer send. origin_plugin scoping keeps plugin-mediated
// transfers (Chyme tips, LevelUp flows…) counted once, in their originating plugin.
const serviceCreditsPeerSends = windowCount(
  'service_credits_transfers',
  'completed_at',
  `status = 'completed' AND origin_plugin = 'service-credits' AND sender_user_id <> recipient_user_id`,
);

// Contributions: confirmed real dollars this week (SUM, not a row count).
const contributionsConfirmedUsd = (weekStart: string) =>
  guardedScalar(
    'contributions_submissions',
    `SELECT COALESCE(SUM(confirmed_amount_usd), 0)::text AS v FROM contributions_submissions
     WHERE status = 'confirmed'
       AND reviewed_at >= $1::date AND reviewed_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );

// SkillsHunt: a nomination a moderator accepted (produces a real Directory profile + reward).
const skillsHuntAccepted = windowCount(
  'skills_hunt_submissions',
  'reviewed_at',
  `status = 'accepted' AND deleted_at IS NULL`,
);

// WhatWorks: an approved tool contributed (primary) and an endorsement given (secondary).
const whatWorksApproved = windowCount('what_works_products', 'reviewed_at', `status = 'approved'`);
const whatWorksEndorsements = windowCount('what_works_endorsements', 'created_at');

// LevelUp: delivered value is COMPLETION (the old dashboard counted enrollments started — intent).
// No completed_at column; the status flip writes updated_at.
const levelUpCompletions = windowCount('level_up_enrollments', 'updated_at', `status = 'completed'`);
const levelUpTrainerPayouts = windowCount(
  'level_up_disbursements',
  'created_at',
  `disbursement_type = 'trainer_payout'`,
);

// Recurring Activity: a tie the counterparty confirmed this week.
const recurringTiesConfirmed = windowCount('recurring_activities', 'confirmed_at');

// PeerProgramming: distinct members who posted in their cohort this week (participation IS the
// plugin's purpose; weighs low for gating but is the honest dashboard signal).
const peerProgrammingActivePosters = (weekStart: string) =>
  guardedScalar(
    'peer_programming_messages',
    `SELECT COUNT(DISTINCT author_user_id)::text AS v FROM peer_programming_messages
     WHERE created_at >= $1::date AND created_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );

// Beacon: member engagement per unique broadcast — distinct (member, broadcast) pairs that reacted
// to or replied on a broadcast's Commons replay post this week. Broadcast completion itself does NOT
// count (only the owner can start a session — an admin action measures the admin, not members), and
// one member engaging with the same broadcast many times counts once. Live in-event chat/reactions
// are Stream-ephemeral and are not countable here.
const beaconBroadcastEngagement = (weekStart: string) =>
  guardedScalar(
    ['beacon_events', 'feed_community_post_reactions', 'feed_community_replies'],
    `SELECT COUNT(*)::text AS v FROM (
       SELECT r.user_id AS member_id, b.id AS broadcast_id
       FROM beacon_events b
       JOIN feed_community_post_reactions r ON r.post_id = b.commons_recording_post_id
       WHERE r.created_at >= $1::date AND r.created_at < $1::date + INTERVAL '7 days'
       UNION
       SELECT p.author_user_id AS member_id, b.id AS broadcast_id
       FROM beacon_events b
       JOIN feed_community_replies p ON p.post_id = b.commons_recording_post_id
       WHERE p.created_at >= $1::date AND p.created_at < $1::date + INTERVAL '7 days'
     ) engagement`,
    weekStart,
  );

// ── Adoption rows (honest non-value metrics) ──────────────────────────────────

// Two adoption readings about turnout, both built from the shared member-day set in
// lib/engagement/member-activity.ts — a (member, UTC day) pair for every day a member signed in,
// taken from the sign-in record `login_events` and nothing else (owner decision, 2026-08-27). What a
// member did once they were here is a different question and is already answered by the per-plugin
// cards above, from each plugin's own rows; folding those into the headcount makes a number that
// moves when a plugin changes what it writes and cannot be compared across weeks. If a reading here
// looks low, the sign-in record is what to check, not this definition — run
// ctf/scripts/audit-active-members.mjs, which prints the record's span next to the week's count.
// Aggregate only — never a per-member figure.

// Active members: how many different people turned up at all this week. This is the plain headcount
// the average below is easy to misread as.
const activeMembers = (weekStart: string) => safeCount(() => countActiveMembersInWeek(weekStart));

// Daily active members: the average number of members active on a day of this week. The divisor is
// the number of days of the window that have already started (1–7), so the live current week reports
// the average of the days it has actually had instead of a figure watered down by days that have not
// happened yet; every past week divides by the full 7.
const dailyActiveMembers = async (weekStart: string) => {
  const memberDays = await safeCount(() => countMemberDaysInWeek(weekStart));
  return Math.round((memberDays / elapsedDaysInWeek(weekStart)) * 100) / 100;
};

// Directory: findable members — claimed, active, non-deleted profiles holding at least one skill.
// Claim time is not stored, so this is the cumulative count of such profiles created by week end
// (their CURRENT claimed/active state) — the same cumulative pattern the old members.total used.
const directoryFindableMembers = (weekStart: string) =>
  guardedScalar(
    ['directory_profiles', 'directory_profile_skills'],
    `SELECT COUNT(*)::text AS v FROM directory_profiles p
     WHERE p.claimed_by_user_id IS NOT NULL AND p.is_active = TRUE AND p.deleted_at IS NULL
       AND p.created_at < $1::date + INTERVAL '7 days'
       AND EXISTS (SELECT 1 FROM directory_profile_skills s WHERE s.profile_id = p.id)`,
    weekStart,
  );

// Mood: adoption, aggregate only — never an individual reading.
const moodCheckins = windowCount('mood_submissions', 'submitted_at');
const moodAverage = (weekStart: string) =>
  guardedScalar(
    'mood_submissions',
    `SELECT ROUND(AVG(mood_value)::numeric, 2)::text AS v FROM mood_submissions
     WHERE submitted_at >= $1::date AND submitted_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );

// ClickLog: adoption, aggregate only — a private personal tally, so never per-member detail.
const clickLogIncidents = windowCount('click_log_incidents', 'created_at');
const clickLogActiveLoggers = (weekStart: string) =>
  guardedScalar(
    'click_log_incidents',
    `SELECT COUNT(DISTINCT user_id)::text AS v FROM click_log_incidents
     WHERE created_at >= $1::date AND created_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );

// ── Goal rows (state metrics with weekly snapshots) ───────────────────────────

// Current live values. GDP: the Community Value Index (an estimate, never money/price) from the
// same builder the GDP plugin serves. Workforce: recruited = the count of all active Directory
// profiles — the registry definition of workforce_recruited_current_count.
async function liveGdpValueIndex(): Promise<number> {
  try {
    const report = await buildLiveGdpReport();
    const row = report.metrics.find((m) => m.metricKey === 'gdp_value_index');
    return row ? row.metricValue : 0;
  } catch {
    return 0;
  }
}

function liveWorkforceRecruited(weekStart: string): Promise<number> {
  // The trailing ($1::date IS NOT NULL) is always true — it only consumes the week parameter
  // guardedScalar binds, since this is a current-state count with no window.
  return guardedScalar(
    'directory_profiles',
    `SELECT COUNT(*)::text AS v FROM directory_profiles
     WHERE is_active = TRUE AND deleted_at IS NULL AND ($1::date IS NOT NULL)`,
    weekStart,
  );
}

// ISO Monday of the current UTC week — "the current week" for snapshot purposes. Exported for the
// internal goal-snapshot capture route, which records the week's goal readings on a schedule so
// goal history never depends on someone opening the dashboard that week.
export function currentWeekStart(): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return utc.toISOString().slice(0, 10);
}

// Reading the CURRENT week records the live value into that week's snapshot row (last read of the
// week wins — the row converges to the week's closing value). A past week reports its stored
// snapshot; a week that was never read while current reports 0 and renders as "not captured".
async function goalMetricForWeek(metricKey: string, weekStartDate: string, live: () => Promise<number>): Promise<number> {
  const isCurrentWeek = weekStartDate === currentWeekStart();
  try {
    if (!(await tableExists('weekly_performance_goal_snapshots'))) {
      return isCurrentWeek ? await live() : 0;
    }
    if (isCurrentWeek) {
      const value = await live();
      await queryDb(
        `INSERT INTO weekly_performance_goal_snapshots (metric_key, week_start_date, metric_value, captured_at)
         VALUES ($1, $2::date, $3, NOW())
         ON CONFLICT (metric_key, week_start_date)
         DO UPDATE SET metric_value = EXCLUDED.metric_value, captured_at = NOW()`,
        [metricKey, weekStartDate, value],
      );
      return value;
    }
    const stored = await queryDb<{ v: string | null }>(
      `SELECT metric_value::text AS v FROM weekly_performance_goal_snapshots
       WHERE metric_key = $1 AND week_start_date = $2::date`,
      [metricKey, weekStartDate],
    );
    const value = stored.rows[0]?.v;
    return value == null ? 0 : Number(value);
  } catch {
    return 0;
  }
}

type MetricSpec = {
  metricKey: string;
  metricUnit: string;
  sourcePlugin: string;
  compute: (weekStart: string) => Promise<number>;
};

// Order here is the card order on the dashboard: goals, value events, adoption.
const METRIC_SPECS: MetricSpec[] = [
  {
    metricKey: 'goal.gdp_value_index',
    metricUnit: 'index',
    sourcePlugin: 'gdp',
    compute: (weekStart) => goalMetricForWeek('goal.gdp_value_index', weekStart, liveGdpValueIndex),
  },
  {
    metricKey: 'goal.workforce_recruited',
    metricUnit: 'members',
    sourcePlugin: 'workforce',
    compute: (weekStart) =>
      goalMetricForWeek('goal.workforce_recruited', weekStart, () => liveWorkforceRecruited(weekStart)),
  },
  { metricKey: 'value.foundation_calls_answered', metricUnit: 'calls', sourcePlugin: 'foundation', compute: foundationCallsAnswered },
  { metricKey: 'value.socket_relay_requests_fulfilled', metricUnit: 'requests', sourcePlugin: 'socket-relay', compute: socketRelayFulfilled },
  { metricKey: 'value.trust_transport_trips_completed', metricUnit: 'trips', sourcePlugin: 'trust-transport', compute: trustTransportTripsCompleted },
  { metricKey: 'value.lighthouse_stays_completed', metricUnit: 'stays', sourcePlugin: 'lighthouse', compute: lighthouseStaysCompleted },
  { metricKey: 'value.chyme_tips_sent', metricUnit: 'tips', sourcePlugin: 'chyme', compute: chymeTips },
  { metricKey: 'value.service_credits_peer_sends', metricUnit: 'sends', sourcePlugin: 'service-credits', compute: serviceCreditsPeerSends },
  { metricKey: 'value.contributions_confirmed_usd', metricUnit: 'USD', sourcePlugin: 'contributions', compute: contributionsConfirmedUsd },
  { metricKey: 'value.skills_hunt_nominations_accepted', metricUnit: 'nominations', sourcePlugin: 'skills-hunt', compute: skillsHuntAccepted },
  { metricKey: 'value.what_works_tools_approved', metricUnit: 'tools', sourcePlugin: 'what-works', compute: whatWorksApproved },
  { metricKey: 'value.what_works_endorsements_given', metricUnit: 'endorsements', sourcePlugin: 'what-works', compute: whatWorksEndorsements },
  { metricKey: 'value.level_up_completions', metricUnit: 'completions', sourcePlugin: 'level-up', compute: levelUpCompletions },
  { metricKey: 'value.level_up_trainer_payouts', metricUnit: 'payouts', sourcePlugin: 'level-up', compute: levelUpTrainerPayouts },
  { metricKey: 'value.recurring_ties_confirmed', metricUnit: 'ties', sourcePlugin: 'recurring-activity', compute: recurringTiesConfirmed },
  { metricKey: 'value.peer_programming_active_posters', metricUnit: 'members', sourcePlugin: 'peer-programming', compute: peerProgrammingActivePosters },
  { metricKey: 'value.beacon_broadcast_engagement', metricUnit: 'engagements', sourcePlugin: 'beacon', compute: beaconBroadcastEngagement },
  { metricKey: 'adoption.active_members', metricUnit: 'members', sourcePlugin: 'platform', compute: activeMembers },
  { metricKey: 'adoption.daily_active_members', metricUnit: 'per day', sourcePlugin: 'platform', compute: dailyActiveMembers },
  { metricKey: 'adoption.directory_findable_members', metricUnit: 'members', sourcePlugin: 'directory', compute: directoryFindableMembers },
  { metricKey: 'adoption.mood_checkins', metricUnit: 'check-ins', sourcePlugin: 'mood', compute: moodCheckins },
  { metricKey: 'adoption.mood_average', metricUnit: '', sourcePlugin: 'mood', compute: moodAverage },
  { metricKey: 'adoption.click_log_incidents', metricUnit: 'incidents', sourcePlugin: 'click-log', compute: clickLogIncidents },
  { metricKey: 'adoption.click_log_active_loggers', metricUnit: 'members', sourcePlugin: 'click-log', compute: clickLogActiveLoggers },
];

// Compute the live numbers for a week window from upstream plugin tables. Always returns the full
// metric set (a value of 0 is a real, reportable number), so the dashboard renders cards rather than
// a "nothing here yet" placeholder.
export async function computeLiveWeekMetrics(weekStartDate: string): Promise<LiveMetric[]> {
  const values = await Promise.all(METRIC_SPECS.map((spec) => spec.compute(weekStartDate)));
  return METRIC_SPECS.map((spec, index) => ({
    metricKey: spec.metricKey,
    metricValue: values[index],
    metricUnit: spec.metricUnit,
    sourcePlugin: spec.sourcePlugin,
  }));
}
