import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { ensureUniqueSlug, slugifyTitle } from './repository';

// Members propose problems; each waits for an admin, who approves it as new, merges it into a
// problem already on the list, or deletes it as spam. Who proposed a problem (`proposed_by`) is
// read only to cap how many a member has waiting, and is never returned.

export const MAX_PENDING_PROPOSALS = 3;
const SIMILAR_LIMIT = 5;

// `helpedCount` is how many things that helped are on the list under a problem (approved ones).
export type SimilarProblem = { id: string; title: string; helpedCount: number };
// `attachedCount` is what the proposer added under their proposal while it waits; `suggestion` is
// the listed problem it looks most like, if any shares words with it.
export type PendingProblem = { id: string; title: string; createdAt: string; attachedCount: number; suggestion: SimilarProblem | null };

export class ProposalLimitError extends Error {
  constructor() {
    super(`A member can have ${MAX_PENDING_PROPOSALS} problems waiting for review at once.`);
  }
}

export async function proposeProblem(input: { title: string; userId: string }): Promise<{ id: string }> {
  return withDbTransaction(async (client) => {
    const waiting = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM what_works_problems WHERE proposed_by = $1 AND review_status = 'pending'`,
      [input.userId],
    );
    if ((waiting.rows[0]?.n ?? 0) >= MAX_PENDING_PROPOSALS) throw new ProposalLimitError();
    const slug = await ensureUniqueSlug(slugifyTitle(input.title));
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO what_works_problems (slug, title, context, review_status, proposed_by, sort_order)
       VALUES ($1, $2, '', 'pending', $3, 1000)
       RETURNING id`,
      [slug, input.title, input.userId],
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
  const result = await queryDb<{ id: string; title: string; hits: number; helped_count: number }>(
    `SELECT pr.id, pr.title,
            (SELECT COUNT(*) FROM unnest($1::text[]) w WHERE lower(pr.title || ' ' || pr.context) LIKE '%' || w || '%')::int AS hits,
            (SELECT COUNT(*) FROM what_works_products p WHERE p.problem_id = pr.id AND p.status = 'approved')::int AS helped_count
       FROM what_works_problems pr
      WHERE pr.is_active = TRUE AND pr.review_status = 'approved'
      ORDER BY hits DESC, pr.sort_order ASC
      LIMIT $2`,
    [words, SIMILAR_LIMIT],
  );
  return result.rows.filter((row) => row.hits > 0).map((row) => ({ id: row.id, title: row.title, helpedCount: row.helped_count }));
}

// True when the problem is waiting for review and this member proposed it, so they can add what
// helped under it before an admin reads it. The answer never says who proposed anything else.
export async function isOwnPendingProblem(id: string, userId: string): Promise<boolean> {
  const result = await queryDb(
    `SELECT 1 FROM what_works_problems WHERE id = $1 AND review_status = 'pending' AND proposed_by = $2`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listPendingProblems(): Promise<PendingProblem[]> {
  const result = await queryDb<{ id: string; title: string; created_at: Date; attached_count: number }>(
    `SELECT pr.id, pr.title, pr.created_at,
            (SELECT COUNT(*) FROM what_works_products p WHERE p.problem_id = pr.id AND p.status <> 'rejected')::int AS attached_count
       FROM what_works_problems pr
      WHERE pr.review_status = 'pending'
      ORDER BY pr.created_at ASC`,
  );
  // A handful wait at a time, so each one's closest listed problem is looked up on its own.
  return Promise.all(
    result.rows.map(async (row) => ({
      id: row.id,
      title: row.title,
      createdAt: new Date(row.created_at).toISOString(),
      attachedCount: row.attached_count,
      suggestion: (await findSimilarProblems(row.title))[0] ?? null,
    })),
  );
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

// Two problems already on the list that are the same problem: everything under the first (things
// that helped, and every vote on them, which belong to the things) moves to the second, then the
// first goes. Both must be approved and different.
export async function mergeApprovedProblems(id: string, intoId: string): Promise<{ moved: number } | null> {
  if (id === intoId) return null;
  return withDbTransaction(async (client) => {
    const both = await client.query(
      `SELECT id FROM what_works_problems WHERE id = ANY($1::uuid[]) AND review_status = 'approved' FOR UPDATE`,
      [[id, intoId]],
    );
    if ((both.rowCount ?? 0) !== 2) return null;
    const moved = await client.query(`UPDATE what_works_products SET problem_id = $2, updated_at = NOW() WHERE problem_id = $1`, [id, intoId]);
    await client.query(`DELETE FROM what_works_problems WHERE id = $1`, [id]);
    return { moved: moved.rowCount ?? 0 };
  });
}

export async function deleteSpamProblem(id: string): Promise<boolean> {
  const result = await queryDb(`DELETE FROM what_works_problems WHERE id = $1 AND review_status = 'pending'`, [id]);
  return (result.rowCount ?? 0) > 0;
}
