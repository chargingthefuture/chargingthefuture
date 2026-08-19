// CSV rendering of the survey for offline analysis.
//
// One row per reported account, not per response, because the unit of analysis is a removal:
// "how many times" is a row count in this file. A response that reported nothing removed still
// gets one row, with the account columns empty, so the denominator is visible rather than
// silently dropped.
//
// The consent columns come first among the response fields, immediately after the id. Anyone
// opening this file is one copy-paste away from publishing a handle, and the answer to "may I"
// should be on screen before the handle is.

import {
  QUORA_SURVEY_ACTION_LABEL,
  QUORA_SURVEY_REASON_LABEL,
  QUORA_SURVEY_TOPIC_LABEL,
  type QuoraSurveyTopic,
} from 'lib/quora-deletion-survey/constants';
import type { SurveyResponseWithAccounts } from 'lib/quora-deletion-survey/repository';

export const SURVEY_CSV_HEADERS = [
  'response_id',
  'submitted_at',
  'consent_publish_handles',
  'consent_quote',
  'consent_attribute_quote',
  'targeted_individual',
  'any_account_removed',
  'has_current_profile',
  'account_number',
  'handle',
  'what_happened',
  'removed_month',
  'removed_year',
  'reason_quora_gave',
  'appealed',
  'reinstated',
  'topics',
  'approx_post_count',
  'approx_active_months',
  'evidence_note',
  'other_notes',
] as const;

// Quote every field and double any embedded quote. Survey free text contains commas, line
// breaks, and quotation marks as a matter of course, and a spreadsheet that splits one person's
// account into two rows is worse than no export.
function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function topicLabels(topics: QuoraSurveyTopic[]): string {
  return topics.map((topic) => QUORA_SURVEY_TOPIC_LABEL[topic] ?? topic).join('; ');
}

function responseCells(response: SurveyResponseWithAccounts): (string | boolean | null)[] {
  return [
    response.id,
    response.created_at,
    response.consent_publish_handles,
    response.consent_quote,
    response.consent_attribute_quote,
    response.targeted_individual,
    response.any_account_removed,
    // Empty when the optional question was skipped. csvCell writes null as an empty cell, which
    // reads correctly in a spreadsheet as "not answered" rather than as FALSE.
    response.has_current_profile,
  ];
}

function rowsForResponse(response: SurveyResponseWithAccounts): string[] {
  const shared = responseCells(response);
  const trailing = [response.evidence_note, response.other_notes];

  if (response.accounts.length === 0) {
    const blanks = new Array(11).fill(null);
    return [[...shared, ...blanks, ...trailing].map(csvCell).join(',')];
  }

  return response.accounts.map((account, index) =>
    [
      ...shared,
      index + 1,
      account.handle,
      QUORA_SURVEY_ACTION_LABEL[account.action] ?? account.action,
      account.removed_month,
      account.removed_year,
      QUORA_SURVEY_REASON_LABEL[account.stated_reason] ?? account.stated_reason,
      account.appealed,
      account.reinstated,
      topicLabels(account.topics),
      account.approx_post_count,
      account.approx_active_months,
      ...trailing,
    ]
      .map(csvCell)
      .join(','),
  );
}

export function renderSurveyCsv(responses: SurveyResponseWithAccounts[]): string {
  const lines = [SURVEY_CSV_HEADERS.map(csvCell).join(',')];
  for (const response of responses) {
    lines.push(...rowsForResponse(response));
  }
  return `${lines.join('\r\n')}\r\n`;
}
