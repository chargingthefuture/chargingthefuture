// Data access for the public Quora account-deletion survey.
//
// A response and its account rows are written in one transaction: a half-saved response would
// report a person as having lost nothing, which is worse than no row at all.

import { queryDb, withDbTransaction } from 'lib/db/postgres';
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
  targetedIndividual: QuoraSurveyTargetedIndividual;
  anyAccountRemoved: boolean;
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
  targeted_individual: QuoraSurveyTargetedIndividual;
  any_account_removed: boolean;
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
         targeted_individual, any_account_removed, evidence_note, other_notes,
         consent_publish_handles, consent_quote, consent_attribute_quote
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.targetedIndividual,
        input.anyAccountRemoved,
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
    `SELECT id, targeted_individual, any_account_removed, evidence_note, other_notes,
            consent_publish_handles, consent_quote, consent_attribute_quote, created_at
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
};

// The three numbers worth stating in a blog post, counted in the database rather than in a
// spreadsheet someone maintained by hand. `reportedRemovals` is a row count, so it means
// "removals described with a handle and a date", not "removals someone claimed".
export async function getSurveyTotals(): Promise<SurveyTotals> {
  const result = await queryDb<{
    responses: string;
    reported_removals: string;
    consenting: string;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM quora_deletion_survey_responses) AS responses,
       (SELECT COUNT(*)::text FROM quora_deletion_survey_accounts) AS reported_removals,
       (SELECT COUNT(*)::text FROM quora_deletion_survey_responses
         WHERE consent_publish_handles = TRUE) AS consenting`,
  );

  const row = result.rows[0];
  return {
    responses: Number(row?.responses ?? '0'),
    reportedRemovals: Number(row?.reported_removals ?? '0'),
    responsesConsentingToPublishHandles: Number(row?.consenting ?? '0'),
  };
}
