// Data access for the Quora live-account census.

import { queryDb } from 'lib/db/postgres';
import type {
  QuoraCensusAccountState,
  QuoraCensusFrameKind,
  QuoraCensusRunStatus,
  QuoraCensusStance,
  QuoraCensusTopic,
} from 'lib/quora-live-census/constants';

export type CensusRunRow = {
  id: string;
  observed_on: string;
  frame_kind: QuoraCensusFrameKind;
  topic_scope: string;
  sampling_method: string;
  notes: string | null;
  status: QuoraCensusRunStatus;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CensusEntryRow = {
  id: string;
  run_id: string;
  handle: string;
  profile_url: string | null;
  account_state: QuoraCensusAccountState;
  topics: QuoraCensusTopic[];
  stance: QuoraCensusStance;
  approx_answer_count: number | null;
  last_active_year: number | null;
  evidence_url: string | null;
  notes: string | null;
  created_at: string;
};

export type CensusRunSummary = CensusRunRow & { entry_count: number; live_count: number };

export type CreateCensusRunInput = {
  observedOn: string;
  frameKind: QuoraCensusFrameKind;
  topicScope: string;
  samplingMethod: string;
  notes: string | null;
  createdByUserId: string | null;
};

export type CreateCensusEntryInput = {
  runId: string;
  handle: string;
  profileUrl: string | null;
  accountState: QuoraCensusAccountState;
  topics: QuoraCensusTopic[];
  stance: QuoraCensusStance;
  approxAnswerCount: number | null;
  lastActiveYear: number | null;
  evidenceUrl: string | null;
  notes: string | null;
};

export async function createCensusRun(input: CreateCensusRunInput): Promise<CensusRunRow> {
  const result = await queryDb<CensusRunRow>(
    `INSERT INTO quora_live_census_runs (
       observed_on, frame_kind, topic_scope, sampling_method, notes, created_by_user_id
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.observedOn,
      input.frameKind,
      input.topicScope,
      input.samplingMethod,
      input.notes,
      input.createdByUserId,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Census run insert returned no row.');
  }
  return row;
}

// Runs newest observation first, each with its entry count and how many of those are still live.
// The two counts sit together because "how many accounts did you look at" and "how many were
// standing" are the pair a reader needs; either alone invites the wrong reading.
export async function listCensusRuns(limit: number): Promise<CensusRunSummary[]> {
  const result = await queryDb<CensusRunSummary>(
    `SELECT r.*,
            COALESCE(counts.entry_count, 0)::int AS entry_count,
            COALESCE(counts.live_count, 0)::int AS live_count
       FROM quora_live_census_runs r
       LEFT JOIN (
         SELECT run_id,
                COUNT(*) AS entry_count,
                COUNT(*) FILTER (WHERE account_state = 'live') AS live_count
           FROM quora_live_census_entries
          GROUP BY run_id
       ) counts ON counts.run_id = r.id
      ORDER BY r.observed_on DESC, r.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function getCensusRun(runId: string): Promise<CensusRunRow | null> {
  const result = await queryDb<CensusRunRow>(
    'SELECT * FROM quora_live_census_runs WHERE id = $1',
    [runId],
  );
  return result.rows[0] ?? null;
}

export async function listCensusEntries(runId: string): Promise<CensusEntryRow[]> {
  const result = await queryDb<CensusEntryRow>(
    `SELECT * FROM quora_live_census_entries
      WHERE run_id = $1
      ORDER BY created_at ASC`,
    [runId],
  );
  return result.rows;
}

export async function createCensusEntry(input: CreateCensusEntryInput): Promise<CensusEntryRow> {
  const result = await queryDb<CensusEntryRow>(
    `INSERT INTO quora_live_census_entries (
       run_id, handle, profile_url, account_state, topics, stance,
       approx_answer_count, last_active_year, evidence_url, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.runId,
      input.handle,
      input.profileUrl,
      input.accountState,
      input.topics,
      input.stance,
      input.approxAnswerCount,
      input.lastActiveYear,
      input.evidenceUrl,
      input.notes,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Census entry insert returned no row.');
  }
  return row;
}

export async function deleteCensusEntry(runId: string, entryId: string): Promise<boolean> {
  const result = await queryDb(
    'DELETE FROM quora_live_census_entries WHERE id = $1 AND run_id = $2',
    [entryId, runId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function setCensusRunStatus(
  runId: string,
  status: QuoraCensusRunStatus,
): Promise<CensusRunRow | null> {
  const result = await queryDb<CensusRunRow>(
    `UPDATE quora_live_census_runs
        SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [runId, status],
  );
  return result.rows[0] ?? null;
}

export type CensusStateCounts = { live: number; gone: number; renamedOrMoved: number };

// How the run's accounts split by what was found at each one. On an existing-list run this is the
// removal measurement: `gone` against the whole set is a real rate, because the denominator was
// fixed before anything was removed. On a fresh-search run it is close to meaningless, and the
// screens say so rather than printing a number that invites the wrong reading.
export async function getCensusStateCounts(runId: string): Promise<CensusStateCounts> {
  const result = await queryDb<{ account_state: QuoraCensusAccountState; count: string }>(
    `SELECT account_state, COUNT(*)::text AS count
       FROM quora_live_census_entries
      WHERE run_id = $1
      GROUP BY account_state`,
    [runId],
  );

  const counts: CensusStateCounts = { live: 0, gone: 0, renamedOrMoved: 0 };
  for (const row of result.rows) {
    if (row.account_state === 'live') counts.live = Number(row.count);
    if (row.account_state === 'gone') counts.gone = Number(row.count);
    if (row.account_state === 'renamed_or_moved') counts.renamedOrMoved = Number(row.count);
  }
  return counts;
}

export type CensusStanceTally = { stance: QuoraCensusStance; count: number };

// How the live accounts in one run break down by stance. Counted over live accounts only: an
// account that was gone when checked says nothing about what remains, and folding it into the
// tally would quietly understate every category.
export async function getCensusStanceTally(runId: string): Promise<CensusStanceTally[]> {
  const result = await queryDb<{ stance: QuoraCensusStance; count: string }>(
    `SELECT stance, COUNT(*)::text AS count
       FROM quora_live_census_entries
      WHERE run_id = $1 AND account_state = 'live'
      GROUP BY stance
      ORDER BY COUNT(*) DESC`,
    [runId],
  );
  return result.rows.map((row) => ({ stance: row.stance, count: Number(row.count) }));
}
