#!/usr/bin/env node

// Active-member audit — read-only. Answers "is the Weekly Performance dashboard's turnout number
// right, and does the sign-in record even cover this week?"
//
// A member is active on a day when the sign-in record holds a row for them on that day. That record
// is `login_events` — everyone reaches the app through Clerk, so a sign-in is a sign-in whatever
// plugin they then open — and it is the whole definition of the dashboard's "Active Members" and
// "Daily Active Members" rows (owner decision, 2026-08-27). This script counts exactly that table
// and nothing else, so its numbers are the dashboard's numbers.
//
// It also prints the record's own span: the first and last row in the table, and how many rows and
// members it holds in total. A week that reads zero is then answerable from data rather than from
// guesswork — either the record covers that week and nobody signed in, or the record has no rows
// that far back and the zero is missing history, not a quiet week.
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

// Keep this identical to MEMBER_ACTIVITY_TABLE in
// ctf/packages/web/lib/engagement/member-activity.ts — the app and this audit must agree on what
// "active" means, or the audit explains a number the dashboard is not showing.
const SIGN_IN_TABLE = 'login_events';

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

// What the record holds in total, and the window it covers. This is what says whether a zero week is
// a quiet week or a week the record never reached.
async function describeRecord(pool) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS rows,
            COUNT(DISTINCT user_id)::int AS members,
            MIN(created_at)::text AS first_row,
            MAX(created_at)::text AS last_row
     FROM ${SIGN_IN_TABLE}`,
  );
  return result.rows[0];
}

async function auditWeek(pool, weekStartDate, now) {
  const counts = await pool.query(
    `SELECT COUNT(*)::int AS member_days, COUNT(DISTINCT user_id)::int AS members
     FROM (
       SELECT DISTINCT user_id, (created_at AT TIME ZONE 'UTC')::date AS activity_day
       FROM ${SIGN_IN_TABLE}
       WHERE created_at >= $1::date
         AND created_at < $1::date + INTERVAL '7 days'
         AND user_id IS NOT NULL
         AND btrim(user_id) <> ''
     ) member_days`,
    [weekStartDate],
  );

  const days = elapsedDaysInWeek(weekStartDate, now);
  const memberDays = counts.rows[0].member_days;
  return {
    weekStartDate,
    memberDays,
    members: counts.rows[0].members,
    days,
    dailyAverage: memberDays / days,
  };
}

function printRecord(record) {
  console.info(`\nThe sign-in record (${SIGN_IN_TABLE}) holds:`);
  console.info(`  ${record.rows} row(s) for ${record.members} member(s)`);
  if (record.rows === 0) {
    console.info('  It is empty, so every week will read zero until sign-ins are being recorded.');
    return;
  }
  console.info(`  earliest row: ${record.first_row}`);
  console.info(`  latest row:   ${record.last_row}`);
  console.info('  A week before the earliest row reads zero because the record does not reach it,');
  console.info('  which is missing history rather than a week nobody turned up.');
}

function printWeek(report) {
  console.info(`\nWeek starting ${report.weekStartDate} (UTC), ${report.days} day(s) counted`);
  console.info(`  Active Members: ${report.members}`);
  console.info(
    `  Daily Active Members: ${(Math.round(report.dailyAverage * 100) / 100).toFixed(2)} per day ` +
      `(${report.memberDays} member-days / ${report.days} day(s))`,
  );
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
    console.info('Active-member audit — the sign-in record, aggregate counts only.');
    if (!(await tableExists(pool, SIGN_IN_TABLE))) {
      console.error(`This database has no ${SIGN_IN_TABLE} table, so there is nothing to audit.`);
      process.exitCode = 1;
      return;
    }
    printRecord(await describeRecord(pool));
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
