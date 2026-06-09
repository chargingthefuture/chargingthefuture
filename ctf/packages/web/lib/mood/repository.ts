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

// Aggregate, anonymous community mood over the trailing window. This reads only
// mood_value + submitted_at and groups by calendar day; it never selects
// user_id, client_id, the note, or any row-level identifier, so nothing here can
// be tied back to a person. When the window holds fewer than the minimum sample
// of check-ins we report hasEnoughData=false and suppress the per-day averages.
export async function getMoodCommunityPulse(): Promise<MoodCommunityPulse> {
  const windowDays = MOOD_PULSE_WINDOW_DAYS;

  const result = await queryDb<{ day: string; avg_mood: string; count: string }>(
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

  const byIso = new Map<string, { sum: number; count: number }>();
  let totalCount = 0;
  let totalSum = 0;

  for (const row of result.rows) {
    const count = Number.parseInt(row.count, 10);
    const avg = Number.parseFloat(row.avg_mood);
    if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(avg)) continue;
    const iso = row.day;
    byIso.set(iso, { sum: avg * count, count });
    totalCount += count;
    totalSum += avg * count;
  }

  // Build a contiguous day series for the whole window so the chart always has
  // one bar per day, even on days with no check-ins.
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

export async function getMoodEligibility(input: { clientId: string }): Promise<{ eligible: boolean; cooldownUntilIso: string | null; lastSubmissionAtIso: string | null }> {
  const result = await queryDb<{ submitted_at: Date }>(
    `SELECT submitted_at
     FROM mood_submissions
     WHERE client_id = $1
     ORDER BY submitted_at DESC
     LIMIT 1`,
    [input.clientId],
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

export async function createMoodSubmission(input: { userId: string; clientId: string; moodValue: number; note: string | null }) {
  if (!Number.isInteger(input.moodValue) || input.moodValue < 1 || input.moodValue > 5) {
    throw new Error('invalid_payload');
  }

  const eligibility = await getMoodEligibility({ clientId: input.clientId });
  if (!eligibility.eligible) {
    throw new Error('cooldown_active');
  }

  const inserted = await queryDb<{ id: string; submitted_at: Date }>(
    `INSERT INTO mood_submissions (id, user_id, client_id, mood_value, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, submitted_at`,
    [randomUUID(), input.userId, input.clientId, input.moodValue, input.note],
  );

  return {
    id: inserted.rows[0].id,
    submittedAtIso: inserted.rows[0].submitted_at.toISOString(),
  };
}
