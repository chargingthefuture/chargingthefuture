#!/usr/bin/env node

// Active-member audit — read-only. Answers "why does the Weekly Performance dashboard say this many
// people turned up?" by showing, source by source, where a week's member-days actually came from.
//
// A member-day is a (member, UTC day) pair: one day on which one member did something in the app.
// The dashboard's "Active Members" and "Daily Active Members" rows are both built from the union of
// the sources below, so this script prints exactly that union plus each source's own contribution.
// When a number on the dashboard looks too low, this is what tells you whether a source has gone
// quiet: `login_events` reading 1 member while `click_log_incidents` reads 2 means the sign-in
// record is missing a member the app can otherwise see, and the sign-in write is what to look at.
//
// Aggregate counts only. No member is ever named, printed, or written anywhere by this script, and
// it only ever runs SELECTs.
//
// Run (wherever DATABASE_URL is available, e.g. through Infisical):
//   infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
//     node ctf/scripts/audit-active-members.mjs
//
// Options:
//   --week=YYYY-MM-DD   audit that week (any date inside it); defaults to the current week
//   --weeks=N           audit the last N weeks, newest first (default 1)

// Keep this list identical to MEMBER_ACTIVITY_SOURCES in
// ctf/packages/web/lib/engagement/member-activity.ts — the app and this audit must agree on what
// "active" means, or the audit explains a number the dashboard is not showing. A unit test
// (ctf/packages/web/lib/engagement/member-activity.test.ts) compares the two lists and fails when
// they drift apart.
const SOURCES = [
  { table: 'login_events', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'click_log_incidents', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'mood_submissions', userColumn: 'user_id', dateColumn: 'submitted_at' },
  { table: 'feed_community_posts', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'feed_community_replies', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'feed_community_post_reactions', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'peer_programming_messages', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'level_up_dispute_comments', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'weekly_performance_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'gdp_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'workforce_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'trust_admin_audit_trail', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'trust_transport_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'trust_transport_status_events', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'socket_relay_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'socket_relay_request_events', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'foundation_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'foundation_quote_status_events', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'lighthouse_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'service_credits_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'peer_programming_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'beacon_events_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'safety_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'contributor_access_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'recurring_activity_audit_trail', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'skills_hunt_audit_log', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'skills_taxonomy_change_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'level_up_audit_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'contributions_audit_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'directory_profile_change_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'account_restrictions_audit', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'unlock_audit_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'quora_deletion_survey_audit_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'quora_live_census_audit_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'feed_membership_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'announcement_membership_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'llm_inference_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
];

// Mirrors NON_MEMBER_ACTIVITY_ACTOR_IDS in the same module: actor ids the app writes that are not a
// person (a scheduled run, the platform-authored Commons notice, a request with nobody signed in).
const NON_MEMBER_ACTOR_IDS = [
  'anonymous',
  'system',
  'system:commons-guidance',
  'skills-hunt-auto-mission-scheduler',
  'level-up-auto-cohort-scheduler',
  'unlock-incentive-system',
  'internal_service_credits_reclaimer',
];

// The day the sign-in record got its writer. Before this, `login_events` was empty no matter who was
// using the app, so a week ending before it rests entirely on the other sources.
const LOGIN_EVENTS_WRITER_SINCE = '2026-06-16';

function readArg(name) {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : null;
}

// ISO Monday of the UTC week containing `date`.
function weekStartOf(date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return utc.toISOString().slice(0, 10);
}

function shiftWeeks(weekStartDate, weeksBack) {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - weeksBack * 7);
  return start.toISOString().slice(0, 10);
}

// How many days of the week have already started, 1–7 — the divisor behind the daily average.
function elapsedDaysInWeek(weekStartDate, now) {
  const weekStartMs = Date.parse(`${weekStartDate}T00:00:00Z`);
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const elapsed = Math.floor((todayUtcMs - weekStartMs) / 86_400_000) + 1;
  return Math.min(7, Math.max(1, elapsed));
}

async function tableExists(pool, table) {
  const result = await pool.query(`SELECT to_regclass($1)::text AS reg`, [`public.${table}`]);
  return Boolean(result.rows[0]?.reg);
}

function sourceDaysSql(source) {
  return `SELECT DISTINCT ${source.userColumn} AS user_id,
                 (${source.dateColumn} AT TIME ZONE 'UTC')::date AS activity_day
          FROM ${source.table}
          WHERE ${source.dateColumn} >= $1::date
            AND ${source.dateColumn} < $1::date + INTERVAL '7 days'
            AND ${source.userColumn} IS NOT NULL
            AND btrim(${source.userColumn}) <> ''
            AND btrim(${source.userColumn}) <> ALL ($2::text[])`;
}

async function auditWeek(pool, weekStartDate, now) {
  const present = [];
  const perSource = [];

  for (const source of SOURCES) {
    if (!(await tableExists(pool, source.table))) {
      perSource.push({ table: source.table, present: false, memberDays: 0, members: 0 });
      continue;
    }
    present.push(source);
    const counts = await pool.query(
      `SELECT COUNT(*)::int AS member_days, COUNT(DISTINCT user_id)::int AS members
       FROM (${sourceDaysSql(source)}) source_days`,
      [weekStartDate, NON_MEMBER_ACTOR_IDS],
    );
    perSource.push({
      table: source.table,
      present: true,
      memberDays: counts.rows[0].member_days,
      members: counts.rows[0].members,
    });
  }

  let memberDays = 0;
  let members = 0;
  if (present.length > 0) {
    const union = present.map(sourceDaysSql).join('\n          UNION\n');
    const combined = await pool.query(
      `SELECT COUNT(*)::int AS member_days, COUNT(DISTINCT user_id)::int AS members
       FROM (${union}) member_days`,
      [weekStartDate, NON_MEMBER_ACTOR_IDS],
    );
    memberDays = combined.rows[0].member_days;
    members = combined.rows[0].members;
  }

  const days = elapsedDaysInWeek(weekStartDate, now);
  return { weekStartDate, perSource, memberDays, members, days, dailyAverage: memberDays / days };
}

function printWeek(report) {
  console.info(`\nWeek starting ${report.weekStartDate} (UTC), ${report.days} day(s) counted`);
  const NAME_WIDTH = 36;
  console.info(`  ${'Source'.padEnd(NAME_WIDTH)}${'member-days'.padStart(11)}${'members'.padStart(10)}`);

  // Only the sources that actually contributed are listed: the full list is 37 tables and a wall of
  // zeroes buries the ones that matter. The two counts under the table say what was left out.
  const contributing = report.perSource.filter((row) => row.present && row.memberDays > 0);
  for (const row of contributing) {
    console.info(
      `  ${row.table.padEnd(NAME_WIDTH)}${String(row.memberDays).padStart(11)}${String(row.members).padStart(10)}`,
    );
  }
  if (contributing.length === 0) {
    console.info('  (no source recorded anybody this week)');
  }

  const quiet = report.perSource.filter((row) => row.present && row.memberDays === 0).length;
  const missing = report.perSource.filter((row) => !row.present).length;
  console.info(`  ${quiet} source(s) present with no rows this week; ${missing} not in this database.`);
  console.info(
    `  ${'COMBINED (what the dashboard reads)'.padEnd(NAME_WIDTH)}${String(report.memberDays).padStart(11)}${String(report.members).padStart(10)}`,
  );
  console.info(`  Active Members: ${report.members}`);
  console.info(`  Daily Active Members: ${(Math.round(report.dailyAverage * 100) / 100).toFixed(2)} per day (${report.memberDays} member-days / ${report.days} day(s))`);

  const login = report.perSource.find((row) => row.table === 'login_events');
  // The day after the window closes (shifting back by -1 week moves forward one week).
  const weekEndExclusive = shiftWeeks(report.weekStartDate, -1);
  if (report.weekStartDate < LOGIN_EVENTS_WRITER_SINCE) {
    const coverage =
      weekEndExclusive <= LOGIN_EVENTS_WRITER_SINCE
        ? "this week's number rests entirely on the other sources"
        : 'the first days of this week rest entirely on the other sources';
    console.info(
      `  NOTE: nothing wrote login_events until ${LOGIN_EVENTS_WRITER_SINCE}, so ${coverage}.\n` +
        '        A zero here means the app recorded no member action at all in that window,\n' +
        '        not that the sign-in write failed.',
    );
  } else if (login && login.present && login.members < report.members) {
    console.info(
      `  NOTE: ${report.members - login.members} member(s) are visible in the product's own rows but have no sign-in record this week.\n` +
        '        The sign-in write in packages/web/lib/engagement/login-activity.ts is failing or not reached for them;\n' +
        '        check the server log for "[engagement.login-activity] could not record a member-day".',
    );
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    console.error(
      'DATABASE_URL is not set, so this audit has nothing to read. Run it through Infisical:\n' +
        '  infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \\\n' +
        '    node ctf/scripts/audit-active-members.mjs',
    );
    process.exitCode = 1;
    return;
  }

  const now = new Date();
  const weekArg = readArg('week');
  const anchor = weekArg ? new Date(`${weekArg}T00:00:00Z`) : now;
  if (Number.isNaN(anchor.getTime())) {
    console.error(`--week=${weekArg} is not a date this script can read; use YYYY-MM-DD.`);
    process.exitCode = 1;
    return;
  }
  const weeksBack = Math.max(1, Number.parseInt(readArg('weeks') ?? '1', 10) || 1);
  const latestWeekStart = weekStartOf(anchor);

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.info('Active-member audit — member-days per source, aggregate counts only.');
    for (let index = 0; index < weeksBack; index += 1) {
      printWeek(await auditWeek(pool, shiftWeeks(latestWeekStart, index), now));
    }
  } catch (error) {
    console.error(`The audit could not finish: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await main();
