import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { MOOD_COOLDOWN_DAYS, MOOD_PULSE_MIN_DAY_SAMPLE, MOOD_PULSE_MIN_SAMPLE, MOOD_PULSE_WINDOW_DAYS } from './constants';

// One bucket of the community pulse: a single day in the trailing window with
// the average mood (1..5) and how many check-ins it is made of. Never any
// per-user data — only counts and averages.
export type MoodCommunityPulseDay = {
  dateIso: string;
  averageMood: number | null;
  count: number;
};

export type MoodCommunityPulse = {
  windowDays: number;
  minSample: number;
  totalCount: number;
  averageMood: number | null;
  // hasEnoughData is false until at least MOOD_PULSE_MIN_SAMPLE check-ins exist
  // in the window; the UI shows an empty state in that case.
  hasEnoughData: boolean;
  days: MoodCommunityPulseDay[];
};

type MoodPulseBucket = { sum: number; count: number };

type MoodPulseRow = { day: string; avg_mood: string; count: string };

// Fold the per-day query rows into a lookup by ISO date.
// Rows with a non-finite/zero count or a non-finite average are skipped, exactly
// as the inline loop did, so nothing but real check-in data reaches the series.
function aggregateMoodPulseRows(rows: MoodPulseRow[]): {
  byIso: Map<string, MoodPulseBucket>;
} {
  const byIso = new Map<string, MoodPulseBucket>();

  for (const row of rows) {
    const count = Number.parseInt(row.count, 10);
    const avg = Number.parseFloat(row.avg_mood);
    if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(avg)) continue;
    const iso = row.day;
    byIso.set(iso, { sum: avg * count, count });
  }

  return { byIso };
}

// Build a contiguous day series for the entire window so the chart always has
// one bar per day, even on days with no check-ins.
function buildMoodPulseDaySeries(
  windowDays: number,
  byIso: Map<string, MoodPulseBucket>,
): MoodCommunityPulseDay[] {
  const days: MoodCommunityPulseDay[] = [];
  const today = new Date();
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - offset);
    const iso = d.toISOString().slice(0, 10);
    // A day under the per-day floor is left out, so a thin day cannot show one member's mood.
    const found = byIso.get(iso);
    const bucket = found && found.count >= MOOD_PULSE_MIN_DAY_SAMPLE ? found : undefined;
    days.push({
      dateIso: iso,
      averageMood: bucket ? Math.round((bucket.sum / bucket.count) * 100) / 100 : null,
      count: bucket ? bucket.count : 0,
    });
  }
  return days;
}

// Aggregate, anonymous community mood over the trailing window. This reads only
// mood_value + submitted_at and groups by calendar day; it never selects
// user_id, client_id, the note, or any row-level identifier, so nothing here can
// be tied back to a person. When the window holds fewer than the minimum sample
// of check-ins we report hasEnoughData=false and suppress the per-day averages.
export async function getMoodCommunityPulse(): Promise<MoodCommunityPulse> {
  const windowDays = MOOD_PULSE_WINDOW_DAYS;

  const result = await queryDb<MoodPulseRow>(
    `SELECT to_char(date_trunc('day', submitted_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            AVG(mood_value)::numeric(10,4) AS avg_mood,
            COUNT(*) AS count
     FROM mood_submissions
     WHERE (submitted_at AT TIME ZONE 'UTC') >= date_trunc('day', NOW() AT TIME ZONE 'UTC') - (($1::int - 1) * INTERVAL '1 day')
       AND (submitted_at AT TIME ZONE 'UTC') <  date_trunc('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
     GROUP BY day
     ORDER BY day ASC`,
    [windowDays],
  );

  const { byIso } = aggregateMoodPulseRows(result.rows);
  const days = buildMoodPulseDaySeries(windowDays, byIso);
  // The week's figures come from the days that are shown, never from the hidden ones: with the week
  // total and every shown day's average and count, a hidden day's value would follow by subtraction.
  const shown = [...byIso.values()].filter((bucket) => bucket.count >= MOOD_PULSE_MIN_DAY_SAMPLE);
  const totalCount = shown.reduce((sum, bucket) => sum + bucket.count, 0);
  const totalSum = shown.reduce((sum, bucket) => sum + bucket.sum, 0);

  const hasEnoughData = totalCount >= MOOD_PULSE_MIN_SAMPLE;
  const averageMood = hasEnoughData && totalCount > 0 ? Math.round((totalSum / totalCount) * 100) / 100 : null;

  return {
    windowDays,
    minSample: MOOD_PULSE_MIN_SAMPLE,
    totalCount: hasEnoughData ? totalCount : 0,
    averageMood,
    hasEnoughData,
    // Below threshold we still return a flat, empty day series (counts zeroed)
    // so the client renders the empty chart without leaking the small counts.
    days: hasEnoughData ? days : days.map((d) => ({ ...d, averageMood: null, count: 0 })),
  };
}

// Resolve the caller's stable, server-controlled mood pseudonym, creating it on
// first use. This is the ONLY function that reads the user_id ↔ pseudonym map
// (mood_client_identities); every other mood query keys on the pseudonym, so the
// check-in rows never carry the user_id (pseudo-anonymity). Because the pseudonym
// is server-owned and one-per-user, a member cannot mint a fresh one, so keying
// the cooldown on it still cannot be bypassed.
export async function getOrCreateMoodPseudonym(userId: string): Promise<string> {
  const existing = await queryDb<{ pseudonym: string }>(
    `SELECT pseudonym FROM mood_client_identities WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].pseudonym;
  }

  // ON CONFLICT DO UPDATE (no-op) so a concurrent insert still returns the row.
  const inserted = await queryDb<{ pseudonym: string }>(
    `INSERT INTO mood_client_identities (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING pseudonym`,
    [userId],
  );
  return inserted.rows[0].pseudonym;
}

// Eligibility / cooldown is keyed on the server-controlled pseudonym (resolved
// from the verified user via getOrCreateMoodPseudonym), never on the
// client-supplied clientId. The clientId is attacker-controlled, so keying the
// cooldown on it would let a member bypass the 7-day window by rotating it; the
// pseudonym is stable per account and cannot be rotated by the member, and the
// check-in rows carry no user_id.
type MoodEligibility = { eligible: boolean; cooldownUntilIso: string | null; lastSubmissionAtIso: string | null };

function eligibilityFromLastSubmission(lastSubmission: Date | undefined): MoodEligibility {
  if (!lastSubmission) {
    return { eligible: true, cooldownUntilIso: null, lastSubmissionAtIso: null };
  }

  const cooldownUntil = new Date(lastSubmission.getTime() + MOOD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  return {
    eligible: now >= cooldownUntil,
    cooldownUntilIso: cooldownUntil.toISOString(),
    lastSubmissionAtIso: lastSubmission.toISOString(),
  };
}

const LAST_SUBMISSION_SQL = `SELECT submitted_at
     FROM mood_submissions
     WHERE pseudonym = $1
     ORDER BY submitted_at DESC
     LIMIT 1`;

export async function getMoodEligibility(input: { pseudonym: string }): Promise<MoodEligibility> {
  const result = await queryDb<{ submitted_at: Date }>(LAST_SUBMISSION_SQL, [input.pseudonym]);
  return eligibilityFromLastSubmission(result.rows[0]?.submitted_at);
}

export async function createMoodSubmission(input: { pseudonym: string; clientId: string; moodValue: number; note: string | null }) {
  if (!Number.isInteger(input.moodValue) || input.moodValue < 1 || input.moodValue > 5) {
    throw new Error('invalid_payload');
  }

  // The cooldown read and the insert run in one transaction behind a lock on the
  // pseudonym. Without it, two submits sent together (a double tap, two tabs)
  // both read "no check-in this week" and both insert.
  const inserted = await withDbTransaction(async (client: PoolClient) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('mood_submissions:' || $1))`, [input.pseudonym]);
    const last = await client.query<{ submitted_at: Date }>(LAST_SUBMISSION_SQL, [input.pseudonym]);
    if (!eligibilityFromLastSubmission(last.rows[0]?.submitted_at).eligible) {
      throw new Error('cooldown_active');
    }

    // user_id is stored empty on purpose: the check-in row is decoupled from the
    // account. The link lives only in mood_client_identities, keyed by pseudonym.
    return client.query<{ id: string; submitted_at: Date }>(
      `INSERT INTO mood_submissions (id, user_id, client_id, mood_value, note, pseudonym)
       VALUES ($1, '', $2, $3, $4, $5)
       RETURNING id, submitted_at`,
      [randomUUID(), input.clientId, input.moodValue, input.note, input.pseudonym],
    );
  });

  // Field names match the mood.check.submit command contract outputSchema
  // (checkId / submittedAt).
  return {
    checkId: inserted.rows[0].id,
    submittedAt: inserted.rows[0].submitted_at.toISOString(),
  };
}
