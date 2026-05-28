// Skills Hunt — moderation + GDPR delete.
//
// Two flows live here:
//
// 1. Community moderation reports (`skills_hunt_submission_reports`). Any
//    authenticated user can file a report against a submission or a
//    community-generated Directory profile. Admins triage them through a
//    queue and resolve with `dismiss` / `archive` / `removed`.
//
// 2. GDPR-style profile delete. A user can soft-delete every submission they
//    authored. Audit log rows are explicitly preserved (regulatory
//    retention). Directory profiles auto-generated from those submissions
//    are NOT modified here — the Directory plugin owns its own deletion
//    path; Skills Hunt nulls the link by ON DELETE SET NULL where it can.

import type { PoolClient } from 'pg';
import type {
  SkillsHuntSubmissionReport,
  SkillsHuntSubmissionReportReason,
  SkillsHuntSubmissionReportStatus,
} from './types';

const REPORT_RETURN_COLS = `
  id, submission_id, directory_profile_id, reporter_user_id, reporter_username,
  reason, details, status, resolution_notes, resolved_by_user_id, resolved_at,
  created_at
`;

type SkillsHuntSubmissionReportRow = {
  id: string;
  submission_id: string | null;
  directory_profile_id: string | null;
  reporter_user_id: string;
  reporter_username: string | null;
  reason: SkillsHuntSubmissionReportReason;
  details: string | null;
  status: SkillsHuntSubmissionReportStatus;
  resolution_notes: string | null;
  resolved_by_user_id: string | null;
  resolved_at: Date | null;
  created_at: Date;
};

function mapReport(row: SkillsHuntSubmissionReportRow): SkillsHuntSubmissionReport {
  return {
    id: row.id,
    submissionId: row.submission_id,
    directoryProfileId: row.directory_profile_id,
    reporterUserId: row.reporter_user_id,
    reporterUsername: row.reporter_username,
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolutionNotes: row.resolution_notes,
    resolvedByUserId: row.resolved_by_user_id,
    resolvedAtIso: row.resolved_at ? row.resolved_at.toISOString() : null,
    createdAtIso: row.created_at.toISOString(),
  };
}

export type CreateReportInput = {
  submissionId: string | null;
  directoryProfileId: string | null;
  reason: SkillsHuntSubmissionReportReason;
  details?: string | null;
};

export type ResolveReportInput = {
  status: 'dismissed' | 'archived' | 'removed';
  resolutionNotes?: string | null;
};

const VALID_REPORT_REASONS: SkillsHuntSubmissionReportReason[] = [
  'no_permission', 'inaccurate', 'duplicate', 'spam', 'other',
];

export function validateCreateReportInput(input: CreateReportInput): string | null {
  if (!input.submissionId && !input.directoryProfileId) {
    return 'submissionId or directoryProfileId required';
  }
  if (input.submissionId && input.directoryProfileId) {
    return 'only one of submissionId or directoryProfileId';
  }
  if (!VALID_REPORT_REASONS.includes(input.reason)) return 'invalid reason';
  if (input.details && input.details.length > 1000) return 'details max 1000 chars';
  return null;
}

export async function createReport(
  client: PoolClient,
  reporterUserId: string,
  reporterUsername: string | null,
  input: CreateReportInput,
): Promise<SkillsHuntSubmissionReport> {
  const result = await client.query<SkillsHuntSubmissionReportRow>(
    `
      INSERT INTO skills_hunt_submission_reports
        (submission_id, directory_profile_id, reporter_user_id, reporter_username,
         reason, details, status)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, 'open')
      RETURNING ${REPORT_RETURN_COLS}
    `,
    [
      input.submissionId,
      input.directoryProfileId,
      reporterUserId,
      reporterUsername,
      input.reason,
      input.details?.trim() ?? null,
    ],
  );
  return mapReport(result.rows[0]);
}

export async function listOpenReports(
  client: PoolClient,
  status: SkillsHuntSubmissionReportStatus | null = null,
): Promise<SkillsHuntSubmissionReport[]> {
  const params: unknown[] = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE status = $${params.length}`;
  } else {
    where = `WHERE status = 'open'`;
  }
  const result = await client.query<SkillsHuntSubmissionReportRow>(
    `SELECT ${REPORT_RETURN_COLS} FROM skills_hunt_submission_reports ${where}
     ORDER BY created_at DESC LIMIT 100`,
    params,
  );
  return result.rows.map(mapReport);
}

export async function resolveReport(
  client: PoolClient,
  resolverUserId: string,
  reportId: string,
  input: ResolveReportInput,
): Promise<SkillsHuntSubmissionReport | null> {
  const result = await client.query<SkillsHuntSubmissionReportRow>(
    `
      UPDATE skills_hunt_submission_reports
      SET status = $2,
          resolution_notes = $3,
          resolved_by_user_id = $4,
          resolved_at = NOW()
      WHERE id = $1::uuid AND status = 'open'
      RETURNING ${REPORT_RETURN_COLS}
    `,
    [reportId, input.status, input.resolutionNotes?.trim() ?? null, resolverUserId],
  );
  return result.rows[0] ? mapReport(result.rows[0]) : null;
}

// GDPR soft-delete: marks every submission authored by the user as deleted,
// then recomputes derived state in the same transaction:
//   - Leaderboard rebuild for every affected round so the user disappears
//     from rankings immediately.
//   - Mission progress recompute for every affected round so completed
//     missions reflect the deletion (and may roll back to incomplete).
// Audit log entries are preserved (regulatory).
export async function softDeleteUserSubmissions(
  client: PoolClient,
  userId: string,
  // Optional recompute hooks injected by the caller so this module stays
  // free of import cycles with repository.ts / missions.ts. Both default to
  // no-ops; the route handler wires the real implementations.
  hooks: {
    rebuildLeaderboard?: (client: PoolClient, roundId: string) => Promise<void>;
    recomputeMissions?: (client: PoolClient, roundId: string, userId: string) => Promise<unknown>;
  } = {},
): Promise<{ deleted: number; rebuiltRounds: number }> {
  // Capture which rounds will be affected BEFORE the UPDATE; we re-read
  // the affected rounds after the soft-delete so the leaderboard rebuild
  // honors the new deleted_at filter.
  const affectedRounds = await client.query<{ round_id: string }>(
    `SELECT DISTINCT round_id FROM skills_hunt_submissions
     WHERE submitter_user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );

  const result = await client.query(
    `
      UPDATE skills_hunt_submissions
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE submitter_user_id = $1 AND deleted_at IS NULL
    `,
    [userId],
  );

  let rebuilt = 0;
  for (const row of affectedRounds.rows) {
    if (hooks.rebuildLeaderboard) {
      await hooks.rebuildLeaderboard(client, row.round_id);
      rebuilt += 1;
    }
    if (hooks.recomputeMissions) {
      await hooks.recomputeMissions(client, row.round_id, userId);
    }
  }

  return { deleted: result.rowCount ?? 0, rebuiltRounds: rebuilt };
}
