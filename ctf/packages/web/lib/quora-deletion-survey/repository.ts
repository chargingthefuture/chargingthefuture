// Data access for the public Quora account-deletion survey.
//
// A response and its account rows are written in one transaction: a half-saved response would
// report a person as having lost nothing, which is worse than no row at all.

import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { failureReason } from 'lib/errors/failure';
import {
  type QuoraSurveyAction,
  type QuoraSurveyReason,
  type QuoraSurveyTargetedIndividual,
  type QuoraSurveyTopic,
} from 'lib/quora-deletion-survey/constants';

export type SurveyAccountInput = {
  handle: string;
  action: QuoraSurveyAction;
  removedMonth: number | null;
  removedYear: number | null;
  statedReason: QuoraSurveyReason;
  appealed: boolean;
  reinstated: boolean;
  topics: QuoraSurveyTopic[];
  approxPostCount: number | null;
  approxActiveMonths: number | null;
};

export type CreateSurveyResponseInput = {
  // The member who sent this. Set on every insert (owner decision, 2026-08-19 — the survey
  // documents handle history and the respondent is not being hidden from the reader).
  userId: string;
  targetedIndividual: QuoraSurveyTargetedIndividual;
  anyAccountRemoved: boolean;
  // Null means the optional question was skipped, which is not the same answer as no.
  hasCurrentProfile: boolean | null;
  evidenceNote: string | null;
  otherNotes: string | null;
  consentPublishHandles: boolean;
  consentQuote: boolean;
  consentAttributeQuote: boolean;
  accounts: SurveyAccountInput[];
};

export type SurveyAccountRow = {
  id: string;
  response_id: string;
  position: number;
  handle: string;
  action: QuoraSurveyAction;
  removed_month: number | null;
  removed_year: number | null;
  stated_reason: QuoraSurveyReason;
  appealed: boolean;
  reinstated: boolean;
  topics: QuoraSurveyTopic[];
  approx_post_count: number | null;
  approx_active_months: number | null;
  created_at: string;
};

export type SurveyResponseRow = {
  id: string;
  // NULL means the account that sent this was deleted, never that the response was anonymous.
  user_id: string | null;
  targeted_individual: QuoraSurveyTargetedIndividual;
  any_account_removed: boolean;
  has_current_profile: boolean | null;
  evidence_note: string | null;
  other_notes: string | null;
  consent_publish_handles: boolean;
  consent_quote: boolean;
  consent_attribute_quote: boolean;
  created_at: string;
};

export type SurveyResponseWithAccounts = SurveyResponseRow & {
  accounts: SurveyAccountRow[];
};

// Store one response and every account row it listed. Returns the response id and how many
// account rows landed — the count the survey actually reports, since it is derived from rows
// rather than from a number the person typed.
export async function createSurveyResponse(
  input: CreateSurveyResponseInput,
): Promise<{ id: string; accountCount: number }> {
  return withDbTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO quora_deletion_survey_responses (
         user_id, targeted_individual, any_account_removed, has_current_profile, evidence_note,
         other_notes, consent_publish_handles, consent_quote, consent_attribute_quote
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.userId,
        input.targetedIndividual,
        input.anyAccountRemoved,
        input.hasCurrentProfile,
        input.evidenceNote,
        input.otherNotes,
        input.consentPublishHandles,
        input.consentQuote,
        input.consentAttributeQuote,
      ],
    );

    const responseId = inserted.rows[0]?.id;
    if (!responseId) {
      throw new Error('Survey response insert returned no id.');
    }

    for (const [index, account] of input.accounts.entries()) {
      await client.query(
        `INSERT INTO quora_deletion_survey_accounts (
           response_id, position, handle, action, removed_month, removed_year,
           stated_reason, appealed, reinstated, topics, approx_post_count, approx_active_months
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          responseId,
          index,
          account.handle,
          account.action,
          account.removedMonth,
          account.removedYear,
          account.statedReason,
          account.appealed,
          account.reinstated,
          account.topics,
          account.approxPostCount,
          account.approxActiveMonths,
        ],
      );
    }

    return { id: responseId, accountCount: input.accounts.length };
  });
}

// Every response, newest first, each with its account rows attached. The admin surface is the
// only reader; there is no public projection of this data at all.
export async function listSurveyResponses(limit: number): Promise<SurveyResponseWithAccounts[]> {
  const responses = await queryDb<SurveyResponseRow>(
    `SELECT id, user_id, targeted_individual, any_account_removed, has_current_profile, evidence_note,
            other_notes, consent_publish_handles, consent_quote, consent_attribute_quote, created_at
       FROM quora_deletion_survey_responses
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );

  if (responses.rows.length === 0) {
    return [];
  }

  const accounts = await queryDb<SurveyAccountRow>(
    `SELECT id, response_id, position, handle, action, removed_month, removed_year,
            stated_reason, appealed, reinstated, topics, approx_post_count,
            approx_active_months, created_at
       FROM quora_deletion_survey_accounts
      WHERE response_id = ANY($1::uuid[])
      ORDER BY response_id, position`,
    [responses.rows.map((row) => row.id)],
  );

  const byResponse = new Map<string, SurveyAccountRow[]>();
  for (const account of accounts.rows) {
    const existing = byResponse.get(account.response_id);
    if (existing) {
      existing.push(account);
    } else {
      byResponse.set(account.response_id, [account]);
    }
  }

  return responses.rows.map((row) => ({ ...row, accounts: byResponse.get(row.id) ?? [] }));
}

export type SurveyTotals = {
  responses: number;
  reportedRemovals: number;
  responsesConsentingToPublishHandles: number;
  // How many members sent more than one response. Anything above zero means the response count
  // is larger than the number of people behind it.
  repeatRespondents: number;
};

// The three numbers worth stating in a blog post, counted in the database rather than in a
// spreadsheet someone maintained by hand. `reportedRemovals` is a row count, so it means
// "removals described with a handle and a date", not "removals someone claimed".
export async function getSurveyTotals(): Promise<SurveyTotals> {
  const result = await queryDb<{
    responses: string;
    reported_removals: string;
    consenting: string;
    repeat_respondents: string;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM quora_deletion_survey_responses) AS responses,
       (SELECT COUNT(*)::text FROM quora_deletion_survey_accounts) AS reported_removals,
       (SELECT COUNT(*)::text FROM quora_deletion_survey_responses
         WHERE consent_publish_handles = TRUE) AS consenting,
       -- Members who sent more than one response. The whole reason the member id is on the row:
       -- without it a person answering twice is indistinguishable from two people answering, and
       -- a count quoted in a post would be wrong with nothing to show that it was.
       (SELECT COUNT(*)::text FROM (
          SELECT user_id FROM quora_deletion_survey_responses
           WHERE user_id IS NOT NULL
           GROUP BY user_id HAVING COUNT(*) > 1
        ) AS repeats) AS repeat_respondents`,
  );

  const row = result.rows[0];
  return {
    responses: Number(row?.responses ?? '0'),
    reportedRemovals: Number(row?.reported_removals ?? '0'),
    responsesConsentingToPublishHandles: Number(row?.consenting ?? '0'),
    repeatRespondents: Number(row?.repeat_respondents ?? '0'),
  };
}

export type SurveyAuditInput = {
  // Who did it. Set on every event that has a session behind it — a submission, an admin read or
  // export, a verification. Null only where there was no session to name, which in practice means
  // a submission refused before sign-in.
  actorUserId: string | null;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  responseId?: string | null;
  rowCount?: number | null;
  metadata?: Record<string, unknown>;
};

// Write one audit row. Best-effort, like the Unlock audit writer this is shaped after: the routes
// await it, so a throw would turn a saved response into a 503 for the member. The response is
// already stored by then; losing the audit row is the lesser failure, and the cause is logged.
export async function insertSurveyAudit(input: SurveyAuditInput): Promise<void> {
  try {
    await queryDb(
      `INSERT INTO quora_deletion_survey_audit_log (
         actor_user_id, command, policy_status, reason, response_id, row_count, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        input.actorUserId,
        input.command,
        input.policyStatus,
        input.reason,
        input.responseId ?? null,
        input.rowCount ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch (error) {
    console.error('[quora-deletion-survey.audit] could not write audit row', failureReason(error));
  }
}
