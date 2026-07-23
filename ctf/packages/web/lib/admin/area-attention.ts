import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

// Powers the "new to review" dot on the admin landing tiles. For each admin area that has a real
// review queue on its admin page, we count the items that are actionable (pending / open / unresolved)
// AND arrived after this admin last opened that area. A dot shows when that count is > 0.
//
// Only areas whose admin page actually surfaces the queue are listed — a dot must lead somewhere that
// shows what is new. Areas that are read-only dashboards, config editors, or browse views (directory,
// beacon, lighthouse, foundation, socket-relay, weekly-performance, workforce, feed-announcements,
// contributor-access) have no entry and never get a dot.
//
// Each query takes $1 = the admin's last-seen timestamp for that area (nullable; null = never opened,
// so every actionable row counts). It returns a single integer column `n`. An area with more than one
// queue (skills-hunt, trust-transport) lists several queries; the dot shows if any is > 0.
const ATTENTION_QUERIES: Record<string, string[]> = {
  unlock: [
    `SELECT COUNT(*)::int AS n FROM unlock_verification_submissions
       WHERE review_status = 'pending' AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  comic: [
    `SELECT COUNT(*)::int AS n FROM comic_review_queue
       WHERE status = 'pending' AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  'bug-reports': [
    `SELECT COUNT(*)::int AS n FROM bug_reports
       WHERE status IN ('new', 'held_for_review') AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  contributions: [
    `SELECT COUNT(*)::int AS n FROM contributions_submissions
       WHERE status = 'pending' AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  safety: [
    `SELECT COUNT(*)::int AS n FROM member_safety_reports
       WHERE status = 'open' AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  'skills-hunt': [
    `SELECT COUNT(*)::int AS n FROM skills_hunt_submissions
       WHERE status = 'pending' AND ($1::timestamptz IS NULL OR created_at > $1)`,
    `SELECT COUNT(*)::int AS n FROM skills_hunt_submission_reports
       WHERE status = 'open' AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  'trust-transport': [
    `SELECT COUNT(*)::int AS n FROM trust_transport_disputes
       WHERE status = 'open' AND ($1::timestamptz IS NULL OR created_at > $1)`,
    `SELECT COUNT(*)::int AS n FROM trust_transport_risk_signals
       WHERE is_resolved = FALSE AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  'what-works': [
    `SELECT COUNT(*)::int AS n FROM what_works_products
       WHERE status = 'pending' AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  // PeerProgramming feedback has no status column (it is an inbox, not a resolvable queue), so the dot
  // is purely "feedback arrived since you last opened it".
  'peer-programming': [
    `SELECT COUNT(*)::int AS n FROM peer_programming_feedback
       WHERE $1::timestamptz IS NULL OR created_at > $1`,
  ],
  'level-up': [
    `SELECT COUNT(*)::int AS n FROM level_up_disputes
       WHERE status = 'open' AND ($1::timestamptz IS NULL OR created_at > $1)`,
    `SELECT COUNT(*)::int AS n FROM level_up_milestone_validations
       WHERE status = 'pending' AND ($1::timestamptz IS NULL OR created_at > $1)`,
  ],
  // ServiceCredits disputes have no status column; "open" means no adjustment has been applied yet
  // (no matching service_credits_dispute_adjustments row).
  'service-credits': [
    `SELECT COUNT(*)::int AS n FROM service_credits_disputes d
       LEFT JOIN service_credits_dispute_adjustments a ON a.dispute_case_id = d.id
       WHERE a.id IS NULL AND ($1::timestamptz IS NULL OR d.created_at > $1)`,
  ],
};

// True when this area has a "new to review" signal (so marking it seen is meaningful).
export function isAdminAttentionArea(areaSlug: string): boolean {
  return Object.prototype.hasOwnProperty.call(ATTENTION_QUERIES, areaSlug);
}

// Compute { areaSlug: hasNew } for every area with a signal, for one admin. Best-effort throughout:
// a failure in the seen read, or in any one area's count, degrades to "no dot" rather than breaking
// the admin landing — the tiles must always render.
export async function getAdminAreaAttention(userId: string): Promise<Record<string, boolean>> {
  const attention: Record<string, boolean> = {};

  let seen = new Map<string, Date>();
  try {
    const seenRows = await queryDb<{ area_slug: string; seen_at: Date }>(
      'SELECT area_slug, seen_at FROM admin_area_seen WHERE user_id = $1',
      [userId],
    );
    seen = new Map(seenRows.rows.map((row) => [row.area_slug, row.seen_at]));
  } catch (error) {
    reportError(error, { area: 'admin-attention', op: 'read_seen' });
    // No seen data → every actionable row reads as new (safe default: show the dot).
  }

  const slugs = Object.keys(ATTENTION_QUERIES);
  await Promise.all(
    slugs.map(async (slug) => {
      const since = seen.get(slug) ?? null;
      try {
        const counts = await Promise.all(
          ATTENTION_QUERIES[slug].map((sql) => queryDb<{ n: number }>(sql, [since])),
        );
        attention[slug] = counts.some((result) => (result.rows[0]?.n ?? 0) > 0);
      } catch (error) {
        reportError(error, { area: 'admin-attention', op: `count_${slug}` });
        attention[slug] = false;
      }
    }),
  );

  return attention;
}

// Mark an admin area opened by this admin (clears its dot). A no-op for an area with no signal, so the
// table only ever holds meaningful rows even though the client can call it for any tile.
export async function markAdminAreaSeen(userId: string, areaSlug: string): Promise<void> {
  if (!isAdminAttentionArea(areaSlug)) {
    return;
  }
  await queryDb(
    `
      INSERT INTO admin_area_seen (user_id, area_slug, seen_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, area_slug) DO UPDATE SET seen_at = NOW()
    `,
    [userId, areaSlug],
  );
}
