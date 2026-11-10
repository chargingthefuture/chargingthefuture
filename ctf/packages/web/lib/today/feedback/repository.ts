import type { SeTodayFeedback } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// today_card_feedback_counts: one row per UTC day, card source, card kind and signal, holding how
// many times members marked such a card done or picked Not for me. Nothing about who tapped is
// stored or passed here.

export const FEEDBACK_WINDOW_DAYS = 30;

export type FeedbackTotalRow = { source: string; kind: string; done: number; notForMe: number };

export async function addTodayFeedback(feedback: SeTodayFeedback): Promise<void> {
  await queryDb(
    `INSERT INTO today_card_feedback_counts (day, source, kind, signal, count)
     VALUES ((NOW() AT TIME ZONE 'UTC')::date, $1, $2, $3, 1)
     ON CONFLICT (day, source, kind, signal) DO UPDATE SET count = today_card_feedback_counts.count + 1`,
    [feedback.source, feedback.kind, feedback.signal],
  );
}

type RawTotal = { source: string; kind: string; done: string | number; not_for_me: string | number };

// The last 30 days (today included), summed per source and kind.
export async function readTodayFeedbackTotals(): Promise<FeedbackTotalRow[]> {
  const result = await queryDb<RawTotal>(
    `SELECT source, kind,
            COALESCE(SUM(count) FILTER (WHERE signal = 'done'), 0) AS done,
            COALESCE(SUM(count) FILTER (WHERE signal = 'not_for_me'), 0) AS not_for_me
       FROM today_card_feedback_counts
      WHERE day > (NOW() AT TIME ZONE 'UTC')::date - $1::int
      GROUP BY source, kind`,
    [FEEDBACK_WINDOW_DAYS],
  );
  return result.rows.map((row) => ({ source: row.source, kind: row.kind, done: Number(row.done), notForMe: Number(row.not_for_me) }));
}
