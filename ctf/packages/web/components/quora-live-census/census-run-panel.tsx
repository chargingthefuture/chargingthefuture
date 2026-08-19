'use client';

import { Download, Trash2 } from 'lucide-react';
import {
  QUORA_CENSUS_ACCOUNT_STATE_LABEL,
  QUORA_CENSUS_STANCE_LABEL,
  QUORA_CENSUS_TOPIC_LABEL,
  type QuoraCensusTopic,
} from 'lib/quora-live-census/constants';
import type { CensusEntryRow, CensusStanceTally } from 'lib/quora-live-census/repository';
import type { CensusTokens } from './census-theme';
import { buttonStyle, cardStyle, mutedStyle } from './census-styles';
import type { RunDetail } from './census-api';

function topicLabels(topics: QuoraCensusTopic[]): string {
  return topics.map((topic) => QUORA_CENSUS_TOPIC_LABEL[topic] ?? topic).join('; ') || 'no subjects coded';
}

// The stance breakdown, over live accounts only. Shown as counts and as a share of the live
// accounts in this run — never as a share of Quora, which the census cannot speak to.
export function CensusTally({
  tally,
  tokens,
}: {
  tally: CensusStanceTally[];
  tokens: CensusTokens;
}) {
  const total = tally.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return (
      <section style={cardStyle(tokens)}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: tokens.TITLE }}>
          What is standing
        </h3>
        <p style={mutedStyle(tokens)}>No live accounts coded in this run yet.</p>
      </section>
    );
  }

  return (
    <section style={cardStyle(tokens)}>
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', color: tokens.TITLE }}>
        What is standing
      </h3>
      <p style={mutedStyle(tokens)}>
        {total} live account{total === 1 ? '' : 's'} in this run. Percentages are of these accounts,
        not of Quora — the census can only speak for what this run actually looked at.
      </p>
      <div style={{ marginTop: 10 }}>
        {tally.map((row) => (
          <div
            key={row.stance}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              padding: '6px 0',
              borderTop: `1px solid ${tokens.BORDER_SOLID}`,
              fontSize: 13,
              color: tokens.TEXT,
            }}
          >
            <span>{QUORA_CENSUS_STANCE_LABEL[row.stance] ?? row.stance}</span>
            <span style={{ color: tokens.TITLE, fontWeight: 700 }}>
              {row.count} · {Math.round((row.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EntryRow({
  entry,
  tokens,
  canRemove,
  onRemove,
}: {
  entry: CensusEntryRow;
  tokens: CensusTokens;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: `1px solid ${tokens.BORDER_SOLID}`,
        fontSize: 13,
        lineHeight: 1.6,
        color: tokens.TEXT,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: tokens.TITLE }}>{entry.handle}</strong>
        {canRemove ? (
          <button type="button" onClick={onRemove} style={{ ...buttonStyle(tokens), padding: '4px 9px', fontSize: 12 }}>
            <Trash2 size={13} aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>
      <div>
        {QUORA_CENSUS_ACCOUNT_STATE_LABEL[entry.account_state] ?? entry.account_state}
        {' · '}
        {QUORA_CENSUS_STANCE_LABEL[entry.stance] ?? entry.stance}
      </div>
      <div style={{ color: tokens.MUTED }}>{topicLabels(entry.topics)}</div>
      <div style={{ color: tokens.MUTED }}>
        {entry.approx_answer_count === null ? '' : `~${entry.approx_answer_count} answers · `}
        {entry.last_active_year === null ? 'last active not recorded' : `last active ${entry.last_active_year}`}
      </div>
      {entry.notes ? <div style={{ whiteSpace: 'pre-wrap' }}>{entry.notes}</div> : null}
    </div>
  );
}

export function CensusEntryList({
  detail,
  tokens,
  onRemove,
}: {
  detail: RunDetail;
  tokens: CensusTokens;
  onRemove: (entryId: string) => void;
}) {
  return (
    <section style={cardStyle(tokens)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: tokens.TITLE }}>
          Coded accounts ({detail.entries.length})
        </h3>
        <a href={`/api/quora-live-census/runs/${detail.run.id}/export`} style={buttonStyle(tokens)}>
          <Download size={14} aria-hidden="true" />
          CSV
        </a>
      </div>

      {detail.entries.length === 0 ? (
        <p style={mutedStyle(tokens)}>Nothing coded yet.</p>
      ) : (
        detail.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            tokens={tokens}
            canRemove={detail.run.status === 'open'}
            onRemove={() => onRemove(entry.id)}
          />
        ))
      )}
    </section>
  );
}
