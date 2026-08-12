import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

// Powers the "new to review" dot on the admin landing tiles. For each admin area that has a real
// review queue on its admin page, we count the items that are actionable (pending / open / unresolved)
// AND arrived after this admin last opened that area. A dot shows when that count is > 0.
//
// Only areas whose admin page actually surfaces the queue are listed — a dot must lead somewhere that
// shows what is new. (Mutual Time's admin page is `/apps/mutual-time`, not `/admin/*`, so its slug is
// still `mutual-time` — the last segment of the tile's href.) Areas that are read-only dashboards,
// config editors, or browse views (directory, beacon, lighthouse, foundation, socket-relay,
// weekly-performance, workforce, feed-announcements, contributor-access) have no entry and never get
// a dot.
//
// Each query takes $1 = the admin's last-seen timestamp for that area (nullable; null = never opened,
// so every actionable row counts). It returns a single integer column `n`. An area with more than one
// queue (skills-hunt, trust-transport) lists several queries; the dot shows if any is > 0.
//
// A query written as `{ sql, scopedToAdmin: true }` also gets $2 = this admin's user id. Use it where
// the queue belongs to one admin rather than to all of them — Mutual Time surveys, for example, are
// each created by one admin, and another admin's survey is not theirs to be told about.
type AttentionQuery = string | { sql: string; scopedToAdmin: true };

const ATTENTION_QUERIES: Record<string, AttentionQuery[]> = {
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
  // Mutual Time is not a review queue — it is a survey the admin has to act on. Two things need
  // telling, both scoped to the surveys this admin created:
  //   1. Somebody picked times on a survey that is still open, so there is now an overlap to look at
  //      and a call to make about when to go live. Nobody having picked anything is not news: no
  //      votes, no dot, and the survey simply stays open until someone does.
  //   2. A survey with a close time reached it and chose its own time. That one has to be seen — the
  //      admin never pressed anything, and the meeting is now scheduled. A survey the admin closed by
  //      hand raises nothing: they were there.
  // Only picks still ahead of now count, matching the rolling window — a vote whose time has passed
  // is not something to go live for.
  'mutual-time': [
    {
      sql: `SELECT COUNT(*)::int AS n FROM mutual_time_votes v
              JOIN mutual_time_events e ON e.id = v.event_id
              WHERE e.created_by_user_id = $2
                AND e.status = 'open'
                AND v.slot_start_utc > NOW()
                AND ($1::timestamptz IS NULL OR v.created_at > $1)`,
      scopedToAdmin: true,
    },
    // A survey only flips to closed when someone next reads it, so "past its close time but still
    // stored as open" is the same news as "already auto-closed" and both belong here — otherwise a
    // survey nobody has opened since its close time would never raise the dot. A survey the admin
    // closed by hand is excluded even once its close time passes.
    {
      sql: `SELECT COUNT(*)::int AS n FROM mutual_time_events
              WHERE created_by_user_id = $2
                AND closes_at IS NOT NULL
                AND closes_at <= NOW()
                AND (status = 'open' OR auto_closed = TRUE)
                AND ($1::timestamptz IS NULL OR COALESCE(closed_at, closes_at) > $1)`,
      scopedToAdmin: true,
    },
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
          ATTENTION_QUERIES[slug].map((query) =>
            typeof query === 'string'
              ? queryDb<{ n: number }>(query, [since])
              : queryDb<{ n: number }>(query.sql, [since, userId]),
          ),
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
