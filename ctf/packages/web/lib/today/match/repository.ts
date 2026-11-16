import { SE_MATCH_NEEDS, seMatchNeedsCovered, seMatchTitleNames, type SeMatchChange, type SeMatchNeeds, type SeMatchState } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// The Match card on Today (owner decision, 2026-11-16). A member's needs are kept on their account in
// today_match_needs: the need keys they picked and the Skills Taxonomy job titles behind them. The
// count is read live on every request with directory_public_match_count, the function the landing
// page counts with: each Directory person once across the job titles, claimed or not, leaving out
// owners restricted with scope all or contact (the directory_person_job_titles view).

const MAX_TITLES = 60;

type NeedsRow = { need_keys: string[] | null; job_title_ids: string[] | null };

export async function readMatchNeeds(accountId: string): Promise<SeMatchNeeds | null> {
  const result = await queryDb<NeedsRow>('SELECT need_keys, job_title_ids FROM today_match_needs WHERE account_id = $1', [accountId]);
  const row = result.rows[0];
  if (!row) return null;
  return { needKeys: row.need_keys ?? [], jobTitleIds: row.job_title_ids ?? [] };
}

export async function countMatches(jobTitleIds: readonly string[]): Promise<number> {
  if (jobTitleIds.length === 0) return 0;
  const result = await queryDb<{ n: number | null }>('SELECT directory_public_match_count($1::text[]) AS n', [jobTitleIds.slice(0, MAX_TITLES)]);
  return Number(result.rows[0]?.n ?? 0);
}

// Active job titles by name, from the same view the landing page reads, so a renamed or retired
// title drops out here as it does there.
async function idsByName(names: readonly string[]): Promise<Map<string, string[]>> {
  const result = await queryDb<{ job_title_id: string; title: string }>(
    'SELECT job_title_id, title FROM directory_public_skill_counts WHERE title = ANY($1::text[])',
    [names],
  );
  const map = new Map<string, string[]>();
  for (const row of result.rows) map.set(row.title, [...(map.get(row.title) ?? []), row.job_title_id]);
  return map;
}

// The job titles a landing page code holds, or null when no code is saved under it. Read only: the
// account keeps a copy of the titles, never the code.
async function readCodeTitles(code: string): Promise<string[] | null> {
  const result = await queryDb<{ ids: string[] | null }>(
    'SELECT COALESCE(job_title_ids, ARRAY[job_title_id]) AS ids FROM directory_landing_match_codes WHERE code = $1',
    [code],
  );
  const row = result.rows[0];
  return row ? (row.ids ?? []).filter(Boolean).slice(0, MAX_TITLES) : null;
}

export type ResolvedNeeds = { kind: 'ok'; needs: SeMatchNeeds } | { kind: 'unknown_code' } | { kind: 'no_titles' };

// What a change saves: the picked needs and their job titles, or a code's job titles with the needs
// they cover in full (the way the landing page puts a code back on its chips).
export async function resolveMatchChange(change: SeMatchChange): Promise<ResolvedNeeds> {
  if (change.kind === 'code') {
    const jobTitleIds = await readCodeTitles(change.code);
    if (jobTitleIds === null) return { kind: 'unknown_code' };
    if (jobTitleIds.length === 0) return { kind: 'no_titles' };
    const allNames = seMatchTitleNames(SE_MATCH_NEEDS.map((need) => need.key));
    return { kind: 'ok', needs: { needKeys: seMatchNeedsCovered(jobTitleIds, await idsByName(allNames)), jobTitleIds } };
  }
  const byName = await idsByName(seMatchTitleNames(change.needKeys));
  const jobTitleIds = [...new Set([...byName.values()].flat())].slice(0, MAX_TITLES);
  return jobTitleIds.length > 0 ? { kind: 'ok', needs: { needKeys: change.needKeys, jobTitleIds } } : { kind: 'no_titles' };
}

export async function saveMatchNeeds(accountId: string, needs: SeMatchNeeds): Promise<void> {
  await queryDb(
    `INSERT INTO today_match_needs (account_id, need_keys, job_title_ids, updated_at)
     VALUES ($1, $2::text[], $3::text[], NOW())
     ON CONFLICT (account_id) DO UPDATE SET need_keys = EXCLUDED.need_keys, job_title_ids = EXCLUDED.job_title_ids, updated_at = NOW()`,
    [accountId, needs.needKeys, needs.jobTitleIds],
  );
}

export async function readMatchState(accountId: string): Promise<SeMatchState> {
  const needs = await readMatchNeeds(accountId);
  return { needs, count: needs ? await countMatches(needs.jobTitleIds) : null };
}
