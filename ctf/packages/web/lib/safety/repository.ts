import type { PoolClient } from 'pg';
import { queryDb } from 'lib/db/postgres';
import type { SafetyReportStatus } from './constants';

// Member safety reports — the data layer for the optional safety escalation on the block flow
// (issue #809, task 3, owner-signed model 2026-06-24). A report is kept in its own table,
// SEPARATE from member_blocks: ordinary blocks are private and the admin never reads them, while a
// safety report (a block the member flagged as a suspected predator / human trafficker) always
// reaches the admin. Every query here is parameterized — ids are never interpolated into SQL.

// One row in the admin safety-report queue, shaped for the admin surface: who reported, who was
// reported (both resolved to a human display label), the optional context, status, timestamps, and
// how many OPEN reports exist about the same reported member so a repeat offender stands out.
export interface AdminSafetyReport {
  id: string;
  reporterUserId: string;
  reporterDisplayName: string;
  reportedUserId: string;
  reportedDisplayName: string;
  detail: string | null;
  status: SafetyReportStatus;
  createdAtIso: string;
  reviewedAtIso: string | null;
  reviewedByUserId: string | null;
  // Count of OPEN reports about reportedUserId (this row included when its own status is open).
  openReportsAboutReported: number;
}

// Insert a safety report inside the caller's transaction (so the block + report are atomic — the
// report cannot exist without its block, and a report-insert failure rolls back the block too).
// Takes a PoolClient because the create-block route wraps both writes in one withDbTransaction.
export async function insertSafetyReportTx(
  client: PoolClient,
  reporterUserId: string,
  reportedUserId: string,
  detail: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO member_safety_reports (reporter_user_id, reported_user_id, detail, status)
     VALUES ($1, $2, $3, 'open')`,
    [reporterUserId, reportedUserId, detail],
  );
}

// List safety reports for the admin queue: open reports first, then newest first. Both the reporter
// and the reported member are resolved to a human label the same way the block manage-list resolves
// them — a LEFT JOIN to directory_profiles on claimed_by_user_id (active profiles only), with a
// neutral "Member" fallback so a missing profile never blanks a row. A correlated subquery attaches
// the count of OPEN reports about each reported member so a repeat offender is obvious at a glance.
export async function listSafetyReportsForAdmin(): Promise<AdminSafetyReport[]> {
  const result = await queryDb<{
    id: string;
    reporter_user_id: string;
    reporter_display_name: string | null;
    reported_user_id: string;
    reported_display_name: string | null;
    detail: string | null;
    status: SafetyReportStatus;
    created_at: Date;
    reviewed_at: Date | null;
    reviewed_by_user_id: string | null;
    open_reports_about_reported: string | number;
  }>(
    `SELECT
       r.id,
       r.reporter_user_id,
       NULLIF(TRIM(COALESCE(rp.first_name, '') || ' ' || COALESCE(rp.last_name, '')), '') AS reporter_display_name,
       r.reported_user_id,
       NULLIF(TRIM(COALESCE(tp.first_name, '') || ' ' || COALESCE(tp.last_name, '')), '') AS reported_display_name,
       r.detail,
       r.status,
       r.created_at,
       r.reviewed_at,
       r.reviewed_by_user_id,
       (
         SELECT COUNT(*)
         FROM member_safety_reports o
         WHERE o.reported_user_id = r.reported_user_id
           AND o.status = 'open'
       ) AS open_reports_about_reported
     FROM member_safety_reports r
     LEFT JOIN directory_profiles rp
       ON rp.claimed_by_user_id = r.reporter_user_id
      AND rp.deleted_at IS NULL
     LEFT JOIN directory_profiles tp
       ON tp.claimed_by_user_id = r.reported_user_id
      AND tp.deleted_at IS NULL
     ORDER BY (r.status = 'open') DESC, r.created_at DESC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    reporterUserId: row.reporter_user_id,
    reporterDisplayName: row.reporter_display_name?.trim() ? row.reporter_display_name.trim() : 'Member',
    reportedUserId: row.reported_user_id,
    reportedDisplayName: row.reported_display_name?.trim() ? row.reported_display_name.trim() : 'Member',
    detail: row.detail,
    status: row.status,
    createdAtIso: new Date(row.created_at).toISOString(),
    reviewedAtIso: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    reviewedByUserId: row.reviewed_by_user_id,
    openReportsAboutReported: Number(row.open_reports_about_reported),
  }));
}

// Mark a report reviewed or dismissed. Only moves a report that is currently `open` (so a double
// action is a no-op rather than re-stamping reviewed_at), stamping who acted and when. Returns true
// when a row changed, false when the report was already actioned or does not exist — the route maps
// false to a clear "not in an actionable state" response.
export async function setSafetyReportStatus(
  reportId: string,
  status: Extract<SafetyReportStatus, 'reviewed' | 'dismissed'>,
  reviewedByUserId: string,
): Promise<boolean> {
  const result = await queryDb(
    `UPDATE member_safety_reports
        SET status = $2,
            reviewed_at = NOW(),
            reviewed_by_user_id = $3
      WHERE id = $1
        AND status = 'open'`,
    [reportId, status, reviewedByUserId],
  );

  return (result.rowCount ?? 0) > 0;
}
