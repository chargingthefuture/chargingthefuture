'use client';

import { Trash2 } from 'lucide-react';
import {
  QUORA_SURVEY_ACTION,
  QUORA_SURVEY_ACTION_LABEL,
  QUORA_SURVEY_EARLIEST_YEAR,
  QUORA_SURVEY_REASON,
  QUORA_SURVEY_REASON_LABEL,
  QUORA_SURVEY_TOPIC,
  QUORA_SURVEY_TOPIC_LABEL,
  type QuoraSurveyTopic,
} from 'lib/quora-deletion-survey/constants';
import type { SurveyTokens } from './survey-theme';
import { CheckboxRow, ChoiceGroup, Field, YesNo, inputStyle } from './survey-fields';

// One removed account, as the person filling in the form describes it. A response holds as many
// of these as the person lost, and the number of them is what "how many times" means in the
// results — nobody is asked to type a total.

export type AccountDraft = {
  key: string;
  handle: string;
  action: string;
  removedMonth: string;
  removedYear: string;
  statedReason: string;
  appealed: boolean;
  reinstated: boolean;
  topics: QuoraSurveyTopic[];
  approxPostCount: string;
  approxActiveMonths: string;
};

export function emptyAccountDraft(key: string): AccountDraft {
  return {
    key,
    handle: '',
    action: 'account_deleted',
    removedMonth: '',
    removedYear: '',
    statedReason: 'none_given',
    appealed: false,
    reinstated: false,
    topics: [],
    approxPostCount: '',
    approxActiveMonths: '',
  };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function yearOptions(): number[] {
  // Built from the constant rather than from the clock so the list is identical on the server and
  // in the browser; a year list that differs between the two is a hydration mismatch.
  const years: number[] = [];
  for (let year = QUORA_SURVEY_EARLIEST_YEAR + 100; year >= QUORA_SURVEY_EARLIEST_YEAR; year -= 1) {
    years.push(year);
  }
  return years;
}

type SectionProps = {
  draft: AccountDraft;
  prefix: string;
  tokens: SurveyTokens;
  set: (patch: Partial<AccountDraft>) => void;
};

function IdentityFields({ draft, prefix, tokens, set }: SectionProps) {
  return (
    <>
      <Field
        id={`${prefix}-handle`}
        label="Handle or profile name"
        hint="However you remember it. An exact match is not needed."
        tokens={tokens}
      >
        <input
          id={`${prefix}-handle`}
          type="text"
          value={draft.handle}
          onChange={(event) => set({ handle: event.target.value })}
          style={inputStyle(tokens)}
          autoComplete="off"
        />
      </Field>

      <Field id={`${prefix}-action`} label="What happened" tokens={tokens}>
        <select
          id={`${prefix}-action`}
          value={draft.action}
          onChange={(event) => set({ action: event.target.value })}
          style={inputStyle(tokens)}
        >
          {QUORA_SURVEY_ACTION.map((action) => (
            <option key={action} value={action}>
              {QUORA_SURVEY_ACTION_LABEL[action]}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function WhenFields({ draft, prefix, tokens, set }: SectionProps) {
  return (
    <>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field id={`${prefix}-month`} label="Month" tokens={tokens}>
            <select
              id={`${prefix}-month`}
              value={draft.removedMonth}
              onChange={(event) => set({ removedMonth: event.target.value })}
              style={inputStyle(tokens)}
            >
              <option value="">Not sure</option>
              {MONTHS.map((month, monthIndex) => (
                <option key={month} value={String(monthIndex + 1)}>
                  {month}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field id={`${prefix}-year`} label="Year" tokens={tokens}>
            <select
              id={`${prefix}-year`}
              value={draft.removedYear}
              onChange={(event) => set({ removedYear: event.target.value })}
              style={inputStyle(tokens)}
            >
              <option value="">Not sure</option>
              {yearOptions().map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <Field
        id={`${prefix}-reason`}
        label="The reason Quora gave"
        hint="No reason given is an answer, and the one we expect most."
        tokens={tokens}
      >
        <select
          id={`${prefix}-reason`}
          value={draft.statedReason}
          onChange={(event) => set({ statedReason: event.target.value })}
          style={inputStyle(tokens)}
        >
          {QUORA_SURVEY_REASON.map((reason) => (
            <option key={reason} value={reason}>
              {QUORA_SURVEY_REASON_LABEL[reason]}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function OutcomeFields({ draft, prefix, tokens, set }: SectionProps) {
  const toggleTopic = (topic: QuoraSurveyTopic, checked: boolean) => {
    set({
      topics: checked ? [...draft.topics, topic] : draft.topics.filter((entry) => entry !== topic),
    });
  };

  return (
    <>
      <ChoiceGroup legend="Did you appeal?" tokens={tokens}>
        <YesNo
          name={`${prefix}-appealed`}
          value={draft.appealed}
          onChange={(next) => set({ appealed: next })}
          tokens={tokens}
        />
      </ChoiceGroup>

      <ChoiceGroup legend="Was anything put back?" tokens={tokens}>
        <YesNo
          name={`${prefix}-reinstated`}
          value={draft.reinstated}
          onChange={(next) => set({ reinstated: next })}
          tokens={tokens}
        />
      </ChoiceGroup>

      <ChoiceGroup
        legend="What did this account mostly write about?"
        hint="Choose as many as fit."
        tokens={tokens}
      >
        {QUORA_SURVEY_TOPIC.map((topic) => (
          <CheckboxRow
            key={topic}
            id={`${prefix}-topic-${topic}`}
            label={QUORA_SURVEY_TOPIC_LABEL[topic]}
            checked={draft.topics.includes(topic)}
            onChange={(checked) => toggleTopic(topic, checked)}
            tokens={tokens}
          />
        ))}
      </ChoiceGroup>
    </>
  );
}

function SizeFields({ draft, prefix, tokens, set }: SectionProps) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <Field
          id={`${prefix}-posts`}
          label="Roughly how many answers or posts"
          hint="A guess is fine. Leave empty if you have no idea."
          tokens={tokens}
        >
          <input
            id={`${prefix}-posts`}
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.approxPostCount}
            onChange={(event) => set({ approxPostCount: event.target.value })}
            style={inputStyle(tokens)}
          />
        </Field>
      </div>
      <div style={{ flex: 1 }}>
        <Field
          id={`${prefix}-months`}
          label="Roughly how many months active"
          hint="From first post to removal."
          tokens={tokens}
        >
          <input
            id={`${prefix}-months`}
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.approxActiveMonths}
            onChange={(event) => set({ approxActiveMonths: event.target.value })}
            style={inputStyle(tokens)}
          />
        </Field>
      </div>
    </div>
  );
}

export function SurveyAccountCard({
  draft,
  index,
  tokens,
  onChange,
  onRemove,
  canRemove,
}: {
  draft: AccountDraft;
  index: number;
  tokens: SurveyTokens;
  onChange: (next: AccountDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const prefix = `account-${draft.key}`;
  const set = (patch: Partial<AccountDraft>) => onChange({ ...draft, ...patch });
  const sectionProps: SectionProps = { draft, prefix, tokens, set };

  return (
    <section
      style={{
        marginTop: 16,
        borderRadius: 14,
        background: tokens.SURFACE,
        border: `1px solid ${tokens.BORDER_SOLID}`,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: tokens.TITLE }}>
          Account {index + 1}
        </h3>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: `1px solid ${tokens.BORDER_SOLID}`,
              borderRadius: 9,
              color: tokens.MUTED,
              fontSize: 13,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>

      <IdentityFields {...sectionProps} />
      <WhenFields {...sectionProps} />
      <OutcomeFields {...sectionProps} />
      <SizeFields {...sectionProps} />
    </section>
  );
}
