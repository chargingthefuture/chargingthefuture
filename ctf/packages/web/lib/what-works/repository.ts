import { queryDb, withDbTransaction } from 'lib/db/postgres';
import type {
  CreateProblemInput,
  ReviewProductInput,
  SuggestProductInput,
  UpdateProblemInput,
  UpdateProductInput,
  WhatWorksAdminProblem,
  WhatWorksAdminProduct,
  WhatWorksList,
  WhatWorksListStats,
  WhatWorksProblem,
  WhatWorksProduct,
  WhatWorksPublicProblem,
  WhatWorksPublicProduct,
} from './types';

function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'problem';
}

// Collisions are tiny in practice, but the loop is capped so a degraded DB or a pathological
// run of identically-named problems fails with a clear error instead of hanging the request.
const MAX_SLUG_ATTEMPTS = 100;

async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const existing = await queryDb<{ id: string }>(
      'SELECT id FROM what_works_problems WHERE slug = $1 LIMIT 1',
      [candidate],
    );
    if (existing.rowCount === 0) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  throw new Error(`what-works: could not find a unique slug for "${base}" after ${MAX_SLUG_ATTEMPTS} attempts`);
}

type ProductProjectionRow = {
  id: string;
  problem_id: string;
  emoji: string;
  name: string;
  kind: string;
  note: string;
  purchase_url: string;
  verified_count: number;
  viewer_has_endorsed: boolean;
};

type ProblemProjectionRow = {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  context: string;
};

function toPublicProduct(row: ProductProjectionRow): WhatWorksPublicProduct {
  return {
    id: row.id,
    emoji: row.emoji,
    name: row.name,
    kind: row.kind,
    note: row.note,
    purchaseUrl: row.purchase_url,
    verifiedCount: Number(row.verified_count ?? 0),
    viewerHasEndorsed: Boolean(row.viewer_has_endorsed),
  };
}

// Single shared reader list: every active problem, each with its approved products beneath it.
// `viewerId` toggles the per-row endorsed flag.
//
// A problem with no approved tools yet is still returned. It used to be dropped here, which meant
// a problem an admin had just added was invisible to members until someone had already suggested a
// tool for it — and nobody could suggest one against a category they could not see. The reader UI
// renders those problems with an "add the first tool" empty state instead.
//
// Scale note: this returns every active problem and every approved product in two unbounded
// queries (no LIMIT/cursor). The list is admin-curated and expected to stay in the low hundreds
// of approved tools, so the full list is fetched in one pass. Add pagination (problem cursor and a
// per-problem product LIMIT) before the approved-product count grows past a few hundred.
export async function getReaderList(viewerId: string | null): Promise<WhatWorksList> {
  const problemsResult = await queryDb<ProblemProjectionRow>(
    `SELECT id, slug, emoji, title, context
       FROM what_works_problems
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, created_at ASC`,
  );

  const productsResult = await queryDb<ProductProjectionRow>(
    `SELECT
        p.id, p.problem_id, p.emoji, p.name, p.kind, p.note, p.purchase_url,
        (SELECT COUNT(*) FROM what_works_endorsements e WHERE e.product_id = p.id)::int AS verified_count,
        CASE
          WHEN $1::text IS NULL THEN FALSE
          ELSE EXISTS (
            SELECT 1 FROM what_works_endorsements e
             WHERE e.product_id = p.id AND e.user_id = $1
          )
        END AS viewer_has_endorsed
       FROM what_works_products p
       JOIN what_works_problems pr ON pr.id = p.problem_id
      WHERE p.status = 'approved' AND pr.is_active = TRUE
      ORDER BY p.created_at ASC`,
    [viewerId],
  );

  const productsByProblem = new Map<string, WhatWorksPublicProduct[]>();
  for (const row of productsResult.rows) {
    const list = productsByProblem.get(row.problem_id) ?? [];
    list.push(toPublicProduct(row));
    productsByProblem.set(row.problem_id, list);
  }

  const problems: WhatWorksPublicProblem[] = [];
  let verifiedTools = 0;
  for (const problem of problemsResult.rows) {
    const products = productsByProblem.get(problem.id) ?? [];
    verifiedTools += products.length;
    problems.push({
      id: problem.id,
      slug: problem.slug,
      emoji: problem.emoji,
      title: problem.title,
      context: problem.context,
      products,
    });
  }

  const stats = await getListStats(problems.length, verifiedTools);
  return { problems, stats };
}

async function getListStats(problemCount: number, verifiedTools: number): Promise<WhatWorksListStats> {
  // "Survivors helped" is the total number of times a survivor marked an approved tool as
  // helping them (the sum of every tool's verified count), matching the design's headline metric.
  const helped = await queryDb<{ survivors_helped: number }>(
    `SELECT COUNT(*)::int AS survivors_helped
       FROM what_works_endorsements e
       JOIN what_works_products p ON p.id = e.product_id
       JOIN what_works_problems pr ON pr.id = p.problem_id
      WHERE p.status = 'approved' AND pr.is_active = TRUE`,
  );
  return {
    problems: problemCount,
    verifiedTools,
    survivorsHelped: Number(helped.rows[0]?.survivors_helped ?? 0),
  };
}

export async function listActiveProblems(): Promise<WhatWorksProblem[]> {
  const result = await queryDb<WhatWorksProblem>(
    `SELECT * FROM what_works_problems
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, created_at ASC`,
  );
  return result.rows;
}

export async function getProblemById(id: string): Promise<WhatWorksProblem | null> {
  const result = await queryDb<WhatWorksProblem>(
    'SELECT * FROM what_works_problems WHERE id = $1 LIMIT 1',
    [id],
  );
  return result.rows[0] ?? null;
}

// Identity columns (`suggested_by`, `reviewed_by`) are deliberately omitted: the anonymity
// contract excludes them from every reader and admin projection, and no caller of this lookup
// needs them. Selecting an explicit column list keeps those fields out of the returned object
// entirely, so a future route cannot accidentally serialize or forward them.
export type WhatWorksProductLookup = Omit<WhatWorksProduct, 'suggested_by' | 'reviewed_by'>;

export async function getProductById(id: string): Promise<WhatWorksProductLookup | null> {
  const result = await queryDb<WhatWorksProductLookup>(
    `SELECT id, problem_id, emoji, name, kind, note, purchase_url, status,
            reviewed_at, rejection_reason, created_at, updated_at
       FROM what_works_products
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

// Suggesting records the product as pending review and auto-counts the suggester as
// its first verifier (they used it and said it helped).
export async function suggestProduct(input: SuggestProductInput): Promise<WhatWorksProduct> {
  return withDbTransaction(async (client) => {
    const inserted = await client.query<WhatWorksProduct>(
      `INSERT INTO what_works_products
         (problem_id, emoji, name, kind, note, purchase_url, status, suggested_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [
        input.problemId,
        input.emoji ?? '',
        input.name,
        input.kind ?? '',
        input.note ?? '',
        input.purchaseUrl,
        input.suggestedBy,
      ],
    );
    const product = inserted.rows[0];
    await client.query(
      `INSERT INTO what_works_endorsements (product_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (product_id, user_id) DO NOTHING`,
      [product.id, input.suggestedBy],
    );
    return product;
  });
}

export async function addEndorsement(productId: string, userId: string): Promise<void> {
  await queryDb(
    `INSERT INTO what_works_endorsements (product_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (product_id, user_id) DO NOTHING`,
    [productId, userId],
  );
}

export async function removeEndorsement(productId: string, userId: string): Promise<void> {
  await queryDb(
    'DELETE FROM what_works_endorsements WHERE product_id = $1 AND user_id = $2',
    [productId, userId],
  );
}

export async function getProductEndorsementState(
  productId: string,
  userId: string | null,
): Promise<{ verifiedCount: number; viewerHasEndorsed: boolean }> {
  const result = await queryDb<{ verified_count: number; viewer_has_endorsed: boolean }>(
    `SELECT
        (SELECT COUNT(*) FROM what_works_endorsements e WHERE e.product_id = $1)::int AS verified_count,
        CASE
          WHEN $2::text IS NULL THEN FALSE
          ELSE EXISTS (SELECT 1 FROM what_works_endorsements e WHERE e.product_id = $1 AND e.user_id = $2)
        END AS viewer_has_endorsed`,
    [productId, userId],
  );
  const row = result.rows[0];
  return {
    verifiedCount: Number(row?.verified_count ?? 0),
    viewerHasEndorsed: Boolean(row?.viewer_has_endorsed),
  };
}

export async function listAdminProblems(): Promise<WhatWorksAdminProblem[]> {
  const result = await queryDb<WhatWorksProblem & {
    product_count: number;
    approved_count: number;
    pending_count: number;
  }>(
    // Explicit column list (not `pr.*`) so a future identity column added to the table is never
    // auto-included in the admin response. `created_by` is the admin's own user ID — it carries no
    // survivor identity — and is part of the admin problem type; survivor-facing identity columns
    // live only on what_works_products and are never selected here.
    `SELECT
        pr.id, pr.slug, pr.emoji, pr.title, pr.context, pr.sort_order,
        pr.is_active, pr.created_by, pr.created_at, pr.updated_at,
        COUNT(p.id)::int AS product_count,
        COUNT(p.id) FILTER (WHERE p.status = 'approved')::int AS approved_count,
        COUNT(p.id) FILTER (WHERE p.status = 'pending')::int AS pending_count
       FROM what_works_problems pr
       LEFT JOIN what_works_products p ON p.problem_id = pr.id
      GROUP BY pr.id
      ORDER BY pr.sort_order ASC, pr.created_at ASC`,
  );
  return result.rows.map((row) => ({
    ...row,
    productCount: Number(row.product_count ?? 0),
    approvedCount: Number(row.approved_count ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
  }));
}

export async function createProblem(input: CreateProblemInput): Promise<WhatWorksProblem> {
  const slug = await ensureUniqueSlug(slugifyTitle(input.title));
  const result = await queryDb<WhatWorksProblem>(
    `INSERT INTO what_works_problems (slug, emoji, title, context, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [slug, input.emoji ?? '', input.title, input.context ?? '', input.sortOrder ?? 0, input.createdBy],
  );
  return result.rows[0];
}

export async function updateProblem(
  id: string,
  patch: UpdateProblemInput,
): Promise<WhatWorksProblem | null> {
  const result = await queryDb<WhatWorksProblem>(
    `UPDATE what_works_problems
        SET emoji = COALESCE($2, emoji),
            title = COALESCE($3, title),
            context = COALESCE($4, context),
            sort_order = COALESCE($5, sort_order),
            is_active = COALESCE($6, is_active),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      id,
      patch.emoji ?? null,
      patch.title ?? null,
      patch.context ?? null,
      patch.sortOrder ?? null,
      patch.isActive ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function deleteProblem(id: string): Promise<boolean> {
  const result = await queryDb('DELETE FROM what_works_problems WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function listAdminProducts(
  status?: WhatWorksProduct['status'],
): Promise<WhatWorksAdminProduct[]> {
  const result = await queryDb<{
    id: string;
    problem_id: string;
    problem_title: string;
    emoji: string;
    name: string;
    kind: string;
    note: string;
    purchase_url: string;
    status: WhatWorksProduct['status'];
    verified_count: number;
    created_at: string;
    reviewed_at: string | null;
    rejection_reason: string | null;
  }>(
    `SELECT
        p.id, p.problem_id, pr.title AS problem_title,
        p.emoji, p.name, p.kind, p.note, p.purchase_url, p.status,
        (SELECT COUNT(*) FROM what_works_endorsements e WHERE e.product_id = p.id)::int AS verified_count,
        -- Cast to ISO text (UTC, RFC-3339 with literal Z) so values match the string types on
        -- AdminProduct (pg returns Date by default; the columns are timestamptz).
        to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        to_char(p.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS reviewed_at,
        p.rejection_reason
       FROM what_works_products p
       JOIN what_works_problems pr ON pr.id = p.problem_id
      WHERE ($1::text IS NULL OR p.status = $1)
      ORDER BY
        CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END ASC,
        p.created_at DESC`,
    [status ?? null],
  );
  return result.rows.map((row) => ({
    id: row.id,
    problemId: row.problem_id,
    problemTitle: row.problem_title,
    emoji: row.emoji,
    name: row.name,
    kind: row.kind,
    note: row.note,
    purchaseUrl: row.purchase_url,
    status: row.status,
    verifiedCount: Number(row.verified_count ?? 0),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
  }));
}

export async function reviewProduct(
  id: string,
  input: ReviewProductInput,
): Promise<WhatWorksProduct | null> {
  const nextStatus = input.action === 'approve' ? 'approved' : 'rejected';
  const result = await queryDb<WhatWorksProduct>(
    `UPDATE what_works_products
        SET status = $2,
            reviewed_by = $3,
            reviewed_at = NOW(),
            rejection_reason = $4,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, nextStatus, input.reviewerId, input.action === 'reject' ? input.rejectionReason ?? null : null],
  );
  return result.rows[0] ?? null;
}

// Correct a suggested tool's own details after the fact (admin fixes a typo, a broken link, a
// wrong note). Status, endorsements, and the identity columns are intentionally left untouched.
// COALESCE lets an omitted field keep its current value; the route always sends the full set.
export async function updateProduct(
  id: string,
  patch: UpdateProductInput,
): Promise<WhatWorksProductLookup | null> {
  const result = await queryDb<WhatWorksProductLookup>(
    `UPDATE what_works_products
        SET emoji = COALESCE($2, emoji),
            name = COALESCE($3, name),
            kind = COALESCE($4, kind),
            note = COALESCE($5, note),
            purchase_url = COALESCE($6, purchase_url),
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, problem_id, emoji, name, kind, note, purchase_url, status,
                reviewed_at, rejection_reason, created_at, updated_at`,
    [
      id,
      patch.emoji ?? null,
      patch.name ?? null,
      patch.kind ?? null,
      patch.note ?? null,
      patch.purchaseUrl ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const result = await queryDb('DELETE FROM what_works_products WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
