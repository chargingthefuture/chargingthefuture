import { randomUUID } from 'crypto';
import { queryDb } from 'lib/db/postgres';
import { MOOD_COOLDOWN_DAYS, MOOD_PULSE_MIN_SAMPLE, MOOD_PULSE_WINDOW_DAYS } from './constants';

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

// Fold the per-day query rows into a lookup by ISO date plus running totals.
// Rows with a non-finite/zero count or a non-finite average are skipped, exactly
// as the inline loop did, so nothing but real check-in data reaches the series.
function aggregateMoodPulseRows(rows: MoodPulseRow[]): {
  byIso: Map<string, MoodPulseBucket>;
  totalCount: number;
  totalSum: number;
} {
  const byIso = new Map<string, MoodPulseBucket>();
  let totalCount = 0;
  let totalSum = 0;

  for (const row of rows) {
    const count = Number.parseInt(row.count, 10);
    const avg = Number.parseFloat(row.avg_mood);
    if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(avg)) continue;
    const iso = row.day;
    byIso.set(iso, { sum: avg * count, count });
    totalCount += count;
    totalSum += avg * count;
  }

  return { byIso, totalCount, totalSum };
}

// Build a contiguous day series for the whole window so the chart always has
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
    const bucket = byIso.get(iso);
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

  const { byIso, totalCount, totalSum } = aggregateMoodPulseRows(result.rows);
  const days = buildMoodPulseDaySeries(windowDays, byIso);

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
export async function getMoodEligibility(input: { pseudonym: string }): Promise<{ eligible: boolean; cooldownUntilIso: string | null; lastSubmissionAtIso: string | null }> {
  const result = await queryDb<{ submitted_at: Date }>(
    `SELECT submitted_at
     FROM mood_submissions
     WHERE pseudonym = $1
     ORDER BY submitted_at DESC
     LIMIT 1`,
    [input.pseudonym],
  );

  if (result.rows.length === 0) {
    return { eligible: true, cooldownUntilIso: null, lastSubmissionAtIso: null };
  }

  const lastSubmission = result.rows[0].submitted_at;
  const cooldownUntil = new Date(lastSubmission.getTime() + MOOD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  return {
    eligible: now >= cooldownUntil,
    cooldownUntilIso: cooldownUntil.toISOString(),
    lastSubmissionAtIso: lastSubmission.toISOString(),
  };
}

export async function createMoodSubmission(input: { pseudonym: string; clientId: string; moodValue: number; note: string | null }) {
  if (!Number.isInteger(input.moodValue) || input.moodValue < 1 || input.moodValue > 5) {
    throw new Error('invalid_payload');
  }

  const eligibility = await getMoodEligibility({ pseudonym: input.pseudonym });
  if (!eligibility.eligible) {
    throw new Error('cooldown_active');
  }

  // user_id is stored empty on purpose: the check-in row is decoupled from the
  // account. The link lives only in mood_client_identities, keyed by pseudonym.
  const inserted = await queryDb<{ id: string; submitted_at: Date }>(
    `INSERT INTO mood_submissions (id, user_id, client_id, mood_value, note, pseudonym)
     VALUES ($1, '', $2, $3, $4, $5)
     RETURNING id, submitted_at`,
    [randomUUID(), input.clientId, input.moodValue, input.note, input.pseudonym],
  );

  // Field names match the mood.check.submit command contract outputSchema
  // (checkId / submittedAt).
  return {
    checkId: inserted.rows[0].id,
    submittedAt: inserted.rows[0].submitted_at.toISOString(),
  };
}
