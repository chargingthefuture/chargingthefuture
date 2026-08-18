'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { failureText, responseFailureText } from '@/lib/errors/client-failure';
import {
  QUORA_SURVEY_ACTION_LABEL,
  QUORA_SURVEY_REASON_LABEL,
  QUORA_SURVEY_TOPIC_LABEL,
  QUORA_SURVEY_PUBLIC_PATH,
} from 'lib/quora-deletion-survey/constants';
import type { SurveyResponseWithAccounts, SurveyTotals } from 'lib/quora-deletion-survey/repository';
import { getSurveyTokens } from './survey-theme';

const LOAD_FAILED = 'The survey responses could not be loaded.';

type AdminPayload = {
  responses: SurveyResponseWithAccounts[];
  totals: SurveyTotals;
  limit: number;
};

// Admin reader for the survey. The only place this data is visible.
//
// Consent is shown on every response, before the handles it applies to. Someone reading this
// screen is deciding what goes into a blog post, and "may I name this person" has to be answered
// on the same line as the name, not looked up somewhere else.
export function QuoraSurveyAdminShell() {
  const { theme } = useTheme();
  const t = getSurveyTokens(theme);
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/quora-deletion-survey/admin/responses', {
        cache: 'no-store',
      });
      if (!response.ok) {
        setError(await responseFailureText(response, LOAD_FAILED));
        return;
      }
      setData((await response.json()) as AdminPayload);
    } catch (caught) {
      setError(failureText(caught, { area: 'quora-deletion-survey', op: 'admin-load', fallback: LOAD_FAILED }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px 56px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>
          Quora account deletion survey
        </h1>
        <p style={{ fontSize: 13, color: t.MUTED, margin: '0 0 16px' }}>
          Self-reports from the public form at {QUORA_SURVEY_PUBLIC_PATH}. Nothing here is verified
          against Quora, and only people who reached another platform could answer — report counts
          of responses, never a share of everyone affected.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <button type="button" onClick={() => void load()} style={buttonStyle(t)}>
            <RefreshCw size={15} aria-hidden="true" />
            Refresh
          </button>
          <a href="/api/quora-deletion-survey/admin/export" style={buttonStyle(t)}>
            <Download size={15} aria-hidden="true" />
            Download CSV
          </a>
        </div>

        {error ? (
          <p role="alert" style={{ ...cardStyle(t), borderColor: '#B91C1C', fontSize: 14 }}>{error}</p>
        ) : null}

        {loading && !data ? <p style={{ fontSize: 14, color: t.MUTED }}>Loading…</p> : null}

        {data ? <TotalsRow totals={data.totals} tokens={t} /> : null}

        {data && data.responses.length === 0 ? (
          <p style={{ ...cardStyle(t), fontSize: 14, color: t.TEXT }}>
            No responses yet. The form is live at {QUORA_SURVEY_PUBLIC_PATH}.
          </p>
        ) : null}

        {data?.responses.map((response) => (
          <ResponseCard key={response.id} response={response} tokens={t} />
        ))}

        {data && data.responses.length >= data.limit ? (
          <p style={{ fontSize: 12, color: t.MUTED, marginTop: 14 }}>
            Showing the newest {data.limit} responses. The CSV export carries every one.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function TotalsRow({ totals, tokens }: { totals: SurveyTotals; tokens: ReturnType<typeof getSurveyTokens> }) {
  const tiles = [
    { label: 'Responses', value: totals.responses },
    { label: 'Removals described', value: totals.reportedRemovals },
    { label: 'Consent to publish handles', value: totals.responsesConsentingToPublishHandles },
  ];
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
      {tiles.map((tile) => (
        <div key={tile.label} style={{ ...cardStyle(tokens), flex: '1 1 180px', marginTop: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: tokens.TITLE }}>{tile.value}</div>
          <div style={{ fontSize: 12, color: tokens.MUTED }}>{tile.label}</div>
        </div>
      ))}
    </div>
  );
}

function ConsentLine({
  response,
  tokens,
}: {
  response: SurveyResponseWithAccounts;
  tokens: ReturnType<typeof getSurveyTokens>;
}) {
  const items = [
    { label: 'publish handles', granted: response.consent_publish_handles },
    { label: 'quote', granted: response.consent_quote },
    { label: 'attribute quote', granted: response.consent_attribute_quote },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {items.map((item) => (
        <span
          key={item.label}
          style={{
            fontSize: 12,
            padding: '3px 9px',
            borderRadius: 999,
            border: `1px solid ${item.granted ? tokens.ACCENT : tokens.BORDER_SOLID}`,
            color: item.granted ? tokens.TITLE : tokens.MUTED,
            background: item.granted ? `${tokens.ACCENT}22` : 'transparent',
          }}
        >
          {item.granted ? 'may ' : 'may not '}
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ResponseCard({
  response,
  tokens,
}: {
  response: SurveyResponseWithAccounts;
  tokens: ReturnType<typeof getSurveyTokens>;
}) {
  return (
    <section style={cardStyle(tokens)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>
          {response.accounts.length} removal{response.accounts.length === 1 ? '' : 's'} reported
        </strong>
        <span style={{ fontSize: 12, color: tokens.MUTED }}>
          {new Date(response.created_at).toISOString().slice(0, 10)} · targeted individual:{' '}
          {response.targeted_individual.replace(/_/g, ' ')}
        </span>
      </div>

      <ConsentLine response={response} tokens={tokens} />

      {response.accounts.map((account) => (
        <div
          key={account.id}
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${tokens.BORDER_SOLID}`,
            fontSize: 13,
            lineHeight: 1.6,
            color: tokens.TEXT,
          }}
        >
          <div style={{ fontWeight: 700, color: tokens.TITLE }}>{account.handle}</div>
          <div>
            {QUORA_SURVEY_ACTION_LABEL[account.action] ?? account.action}
            {account.removed_year ? ` · ${account.removed_month ?? '?'}/${account.removed_year}` : ''}
            {' · '}
            {QUORA_SURVEY_REASON_LABEL[account.stated_reason] ?? account.stated_reason}
          </div>
          <div style={{ color: tokens.MUTED }}>
            {account.topics.map((topic) => QUORA_SURVEY_TOPIC_LABEL[topic] ?? topic).join('; ') ||
              'no subjects given'}
          </div>
          <div style={{ color: tokens.MUTED }}>
            appealed: {account.appealed ? 'yes' : 'no'} · put back:{' '}
            {account.reinstated ? 'yes' : 'no'}
            {account.approx_post_count === null ? '' : ` · ~${account.approx_post_count} posts`}
            {account.approx_active_months === null
              ? ''
              : ` · ~${account.approx_active_months} months active`}
          </div>
        </div>
      ))}

      {response.evidence_note ? (
        <p style={{ marginTop: 10, fontSize: 13, color: tokens.TEXT, whiteSpace: 'pre-wrap' }}>
          <span style={{ color: tokens.MUTED }}>Evidence: </span>
          {response.evidence_note}
        </p>
      ) : null}
      {response.other_notes ? (
        <p style={{ marginTop: 6, fontSize: 13, color: tokens.TEXT, whiteSpace: 'pre-wrap' }}>
          <span style={{ color: tokens.MUTED }}>Notes: </span>
          {response.other_notes}
        </p>
      ) : null}
    </section>
  );
}

function cardStyle(t: ReturnType<typeof getSurveyTokens>): React.CSSProperties {
  return {
    marginTop: 14,
    borderRadius: 14,
    background: t.SURFACE,
    border: `1px solid ${t.BORDER_SOLID}`,
    padding: 16,
  };
}

function buttonStyle(t: ReturnType<typeof getSurveyTokens>): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 14px',
    borderRadius: 10,
    background: 'transparent',
    border: `1px solid ${t.BORDER_SOLID}`,
    color: t.TEXT,
    fontSize: 14,
    textDecoration: 'none',
    cursor: 'pointer',
  };
}
