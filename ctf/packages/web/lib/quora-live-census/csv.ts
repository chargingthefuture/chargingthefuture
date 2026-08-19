// CSV export of one census run.
//
// The run's date and method ride in every row rather than sitting in a header the export loses.
// A census without its observation date and sampling method is not evidence of anything, and a
// spreadsheet pasted into a document tends to arrive without whatever preamble was above it.

import {
  QUORA_CENSUS_ACCOUNT_STATE_LABEL,
  QUORA_CENSUS_STANCE_LABEL,
  QUORA_CENSUS_TOPIC_LABEL,
  type QuoraCensusTopic,
} from 'lib/quora-live-census/constants';
import type { CensusEntryRow, CensusRunRow } from 'lib/quora-live-census/repository';

export const CENSUS_CSV_HEADERS = [
  'run_id',
  'observed_on',
  'frame_kind',
  'run_status',
  'topic_scope',
  'sampling_method',
  'handle',
  'profile_url',
  'account_state',
  'stance',
  'topics',
  'approx_answer_count',
  'last_active_year',
  'evidence_url',
  'notes',
] as const;

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function topicLabels(topics: QuoraCensusTopic[]): string {
  return topics.map((topic) => QUORA_CENSUS_TOPIC_LABEL[topic] ?? topic).join('; ');
}

export function renderCensusCsv(run: CensusRunRow, entries: CensusEntryRow[]): string {
  const runCells = [
    run.id,
    run.observed_on,
    run.frame_kind,
    run.status,
    run.topic_scope,
    run.sampling_method,
  ];
  const lines = [CENSUS_CSV_HEADERS.map(csvCell).join(',')];

  for (const entry of entries) {
    lines.push(
      [
        ...runCells,
        entry.handle,
        entry.profile_url,
        QUORA_CENSUS_ACCOUNT_STATE_LABEL[entry.account_state] ?? entry.account_state,
        QUORA_CENSUS_STANCE_LABEL[entry.stance] ?? entry.stance,
        topicLabels(entry.topics),
        entry.approx_answer_count,
        entry.last_active_year,
        entry.evidence_url,
        entry.notes,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  return `${lines.join('\r\n')}\r\n`;
}
