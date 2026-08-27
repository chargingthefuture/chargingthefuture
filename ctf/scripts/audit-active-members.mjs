#!/usr/bin/env node

// Active-member audit — read-only. Answers "is the Weekly Performance dashboard's turnout number
// right?" and, when it looks low, "is the sign-in write failing?"
//
// A member is active on a day when the sign-in record holds a row for them on that day. That record
// is `login_events`, and it is the whole definition of the dashboard's "Active Members" and "Daily
// Active Members" rows (owner decision, 2026-08-27). This script counts exactly that.
//
// It then counts the per-plugin tables for the same week — separately, and only as a cross-check.
// Those numbers are NOT part of the definition and are not added to it. They answer one question:
// is the sign-in record missing somebody the app can otherwise see? `login_events` reading 1 member
// while `click_log_incidents` reads 2 means a member used the app without a sign-in row landing for
// them, and the write in packages/web/lib/engagement/login-activity.ts is what to look at.
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

// The sign-in record. Keep this identical to MEMBER_ACTIVITY_TABLE in
// ctf/packages/web/lib/engagement/member-activity.ts — the app and this audit must agree on what
// "active" means, or the audit explains a number the dashboard is not showing.
const SIGN_IN_SOURCE = { table: 'login_events', userColumn: 'user_id', dateColumn: 'created_at' };

// Cross-check only: first-party tables a member writes by using the app. Never added to the
// reading above — they exist here to show whether a member used the app without a sign-in row.
const CROSS_CHECK_SOURCES = [
  { table: 'click_log_incidents', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'mood_submissions', userColumn: 'user_id', dateColumn: 'submitted_at' },
  { table: 'feed_community_posts', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'feed_community_replies', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'feed_community_post_reactions', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'peer_programming_messages', userColumn: 'author_user_id', dateColumn: 'created_at' },
];

// The Commons standing notice is authored by the platform, not by a member, so it would otherwise
// show up in the feed cross-check as a person who used the app that day.
const NON_MEMBER_ACTOR_IDS = ['system:commons-guidance'];

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

async function countSource(pool, source, weekStartDate) {
  if (!(await tableExists(pool, source.table))) {
    return { table: source.table, present: false, memberDays: 0, members: 0 };
  }
  const counts = await pool.query(
    `SELECT COUNT(*)::int AS member_days, COUNT(DISTINCT user_id)::int AS members
     FROM (${sourceDaysSql(source)}) source_days`,
    [weekStartDate, NON_MEMBER_ACTOR_IDS],
  );
  return {
    table: source.table,
    present: true,
    memberDays: counts.rows[0].member_days,
    members: counts.rows[0].members,
  };
}

async function auditWeek(pool, weekStartDate, now) {
  const signIn = await countSource(pool, SIGN_IN_SOURCE, weekStartDate);

  const crossCheck = [];
  for (const source of CROSS_CHECK_SOURCES) {
    crossCheck.push(await countSource(pool, source, weekStartDate));
  }

  // How many members the plugins saw that the sign-in record did not. Counted as one set, not as a
  // sum of the rows above, so a member active in three plugins is one member here.
  let unseenByRecord = 0;
  const presentCrossCheck = crossCheck.filter((row) => row.present);
  if (signIn.present && presentCrossCheck.length > 0) {
    const union = presentCrossCheck
      .map((row) => sourceDaysSql(CROSS_CHECK_SOURCES.find((source) => source.table === row.table)))
      .join('\n          UNION\n');
    const missing = await pool.query(
      `SELECT COUNT(*)::int AS members FROM (
         SELECT DISTINCT user_id FROM (${union}) plugin_days
         EXCEPT
         SELECT DISTINCT user_id FROM (${sourceDaysSql(SIGN_IN_SOURCE)}) sign_in_days
       ) unseen`,
      [weekStartDate, NON_MEMBER_ACTOR_IDS],
    );
    unseenByRecord = missing.rows[0].members;
  }

  const days = elapsedDaysInWeek(weekStartDate, now);
  return {
    weekStartDate,
    signIn,
    crossCheck,
    unseenByRecord,
    days,
    dailyAverage: signIn.memberDays / days,
  };
}

function printWeek(report) {
  const NAME_WIDTH = 36;
  const counts = (row) =>
    row.present
      ? String(row.memberDays).padStart(11) + String(row.members).padStart(10)
      : '  (table not in this database)';

  console.info(`\nWeek starting ${report.weekStartDate} (UTC), ${report.days} day(s) counted`);
  console.info(`  ${'Source'.padEnd(NAME_WIDTH)}${'member-days'.padStart(11)}${'members'.padStart(10)}`);
  console.info(`  ${`${report.signIn.table} (THE definition)`.padEnd(NAME_WIDTH)}${counts(report.signIn)}`);
  console.info(`  Active Members: ${report.signIn.members}`);
  console.info(
    `  Daily Active Members: ${(Math.round(report.dailyAverage * 100) / 100).toFixed(2)} per day ` +
      `(${report.signIn.memberDays} member-days / ${report.days} day(s))`,
  );

  console.info('\n  Cross-check only — what the plugins saw. Not part of the numbers above.');
  for (const row of report.crossCheck) {
    console.info(`  ${row.table.padEnd(NAME_WIDTH)}${counts(row)}`);
  }

  if (report.unseenByRecord > 0) {
    console.info(
      `\n  NOTE: ${report.unseenByRecord} member(s) used the app this week with no sign-in record for them.\n` +
        '        The sign-in write in packages/web/lib/engagement/login-activity.ts is failing or not reached;\n' +
        '        check the server log for "[engagement.login-activity] could not record a member-day".\n' +
        '        Fix the write — the dashboard number is the sign-in record by design and must not be widened.',
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
    console.info('Active-member audit — the sign-in record, plus a plugin cross-check. Aggregate counts only.');
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
