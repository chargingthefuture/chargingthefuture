import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { ensureUniqueSlug, slugifyTitle } from './repository';

// Members propose problems; each waits for an admin, who approves it as new, merges it into a
// problem already on the list, or deletes it as spam. Who proposed a problem (`proposed_by`) is
// read only to cap how many a member has waiting, and is never returned.

export const MAX_PENDING_PROPOSALS = 3;
const SIMILAR_LIMIT = 5;

export type PendingProblem = { id: string; title: string; context: string; createdAt: string };
export type SimilarProblem = { id: string; title: string; context: string };

export class ProposalLimitError extends Error {
  constructor() {
    super(`A member can have ${MAX_PENDING_PROPOSALS} problems waiting for review at once.`);
  }
}

export async function proposeProblem(input: { title: string; context: string; userId: string }): Promise<{ id: string }> {
  return withDbTransaction(async (client) => {
    const waiting = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM what_works_problems WHERE proposed_by = $1 AND review_status = 'pending'`,
      [input.userId],
    );
    if ((waiting.rows[0]?.n ?? 0) >= MAX_PENDING_PROPOSALS) throw new ProposalLimitError();
    const slug = await ensureUniqueSlug(slugifyTitle(input.title));
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO what_works_problems (slug, title, context, review_status, proposed_by, sort_order)
       VALUES ($1, $2, $3, 'pending', $4, 1000)
       RETURNING id`,
      [slug, input.title, input.context, input.userId],
    );
    return { id: inserted.rows[0].id };
  });
}

// Problems already on the list that share words with what the member is typing, so they can add
// to one instead of proposing a duplicate. Words shorter than three letters are ignored.
export async function findSimilarProblems(text: string): Promise<SimilarProblem[]> {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3)
    .slice(0, 6);
  if (words.length === 0) return [];
  const result = await queryDb<SimilarProblem & { hits: number }>(
    `SELECT id, title, context,
            (SELECT COUNT(*) FROM unnest($1::text[]) w WHERE lower(title || ' ' || context) LIKE '%' || w || '%')::int AS hits
       FROM what_works_problems
      WHERE is_active = TRUE AND review_status = 'approved'
      ORDER BY hits DESC, sort_order ASC
      LIMIT $2`,
    [words, SIMILAR_LIMIT],
  );
  return result.rows.filter((row) => row.hits > 0).map(({ id, title, context }) => ({ id, title, context }));
}

export async function listPendingProblems(): Promise<PendingProblem[]> {
  const result = await queryDb<{ id: string; title: string; context: string; created_at: Date }>(
    `SELECT id, title, context, created_at FROM what_works_problems WHERE review_status = 'pending' ORDER BY created_at ASC`,
  );
  return result.rows.map((row) => ({ id: row.id, title: row.title, context: row.context, createdAt: new Date(row.created_at).toISOString() }));
}

export async function approveProblem(id: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE what_works_problems SET review_status = 'approved', updated_at = NOW() WHERE id = $1 AND review_status = 'pending'`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

// Anything suggested under the proposal moves to the problem it is merged into, then the proposal
// goes.
export async function mergeProblem(id: string, intoId: string): Promise<boolean> {
  return withDbTransaction(async (client) => {
    const target = await client.query(
      `SELECT 1 FROM what_works_problems WHERE id = $1 AND review_status = 'approved'`,
      [intoId],
    );
    if ((target.rowCount ?? 0) === 0) return false;
    const source = await client.query(`SELECT 1 FROM what_works_problems WHERE id = $1 AND review_status = 'pending' FOR UPDATE`, [id]);
    if ((source.rowCount ?? 0) === 0) return false;
    await client.query(`UPDATE what_works_products SET problem_id = $2, updated_at = NOW() WHERE problem_id = $1`, [id, intoId]);
    const removed = await client.query(`DELETE FROM what_works_problems WHERE id = $1 AND review_status = 'pending'`, [id]);
    return (removed.rowCount ?? 0) > 0;
  });
}

export async function deleteSpamProblem(id: string): Promise<boolean> {
  const result = await queryDb(`DELETE FROM what_works_problems WHERE id = $1 AND review_status = 'pending'`, [id]);
  return (result.rowCount ?? 0) > 0;
}
