'use client';

import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import {
  QUORA_SURVEY_MAX_ACCOUNTS,
  QUORA_SURVEY_TARGETED_INDIVIDUAL,
  type QuoraSurveyTargetedIndividual,
} from 'lib/quora-deletion-survey/constants';
import { getSurveyTokens, type SurveyTokens } from './survey-theme';
import { CheckboxRow, ChoiceGroup, Field, YesNo, hintStyle, inputStyle } from './survey-fields';
import { SurveyAccountCard, emptyAccountDraft, type AccountDraft } from './survey-account-card';
import { SurveyDone, SurveyIntro } from './survey-intro';
import { buildSubmission, submitSurvey } from './survey-submit';
import {
  choiceChipStyle,
  columnStyle,
  errorStyle,
  pageStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './survey-styles';

const TARGETED_LABEL: Record<QuoraSurveyTargetedIndividual, string> = {
  yes: 'Yes',
  no: 'No',
};

function TargetedIndividualQuestion({
  value,
  onChange,
  tokens,
}: {
  value: QuoraSurveyTargetedIndividual | null;
  onChange: (next: QuoraSurveyTargetedIndividual) => void;
  tokens: SurveyTokens;
}) {
  return (
    <ChoiceGroup legend="Do you consider yourself a targeted individual?" tokens={tokens}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {QUORA_SURVEY_TARGETED_INDIVIDUAL.map((option) => (
          <label key={option} htmlFor={`ti-${option}`} style={choiceChipStyle(tokens, value === option)}>
            <input
              id={`ti-${option}`}
              type="radio"
              name="targeted-individual"
              checked={value === option}
              onChange={() => onChange(option)}
              style={{ accentColor: tokens.ACCENT }}
            />
            {TARGETED_LABEL[option]}
          </label>
        ))}
      </div>
    </ChoiceGroup>
  );
}

function AccountsSection({
  accounts,
  setAccounts,
  onAdd,
  tokens,
}: {
  accounts: AccountDraft[];
  setAccounts: (updater: (current: AccountDraft[]) => AccountDraft[]) => void;
  onAdd: () => void;
  tokens: SurveyTokens;
}) {
  return (
    <div>
      <p style={{ ...hintStyle(tokens), marginTop: 18 }}>
        One card per account. Add another for each one you lost — the number of cards is how the
        count is worked out, so nobody has to total it up.
      </p>
      {accounts.map((draft, index) => (
        <SurveyAccountCard
          key={draft.key}
          draft={draft}
          index={index}
          tokens={tokens}
          canRemove={accounts.length > 1}
          onChange={(next) =>
            setAccounts((current) => current.map((entry) => (entry.key === draft.key ? next : entry)))
          }
          onRemove={() => setAccounts((current) => current.filter((entry) => entry.key !== draft.key))}
        />
      ))}
      {accounts.length < QUORA_SURVEY_MAX_ACCOUNTS ? (
        <button type="button" onClick={onAdd} style={secondaryButtonStyle(tokens)}>
          <Plus size={15} aria-hidden="true" />
          Add another account
        </button>
      ) : null}
    </div>
  );
}

type ConsentState = {
  publishHandles: boolean;
  quote: boolean;
  attributeQuote: boolean;
};

function ConsentSection({
  consent,
  onChange,
  tokens,
}: {
  consent: ConsentState;
  onChange: (patch: Partial<ConsentState>) => void;
  tokens: SurveyTokens;
}) {
  return (
    <ChoiceGroup
      legend="What may be published"
      hint="All three start off. Leaving them off still leaves your answer in the count."
      tokens={tokens}
    >
      <CheckboxRow
        id="consent-handles"
        label="You may publish the handle or handles I listed."
        checked={consent.publishHandles}
        onChange={(next) => onChange({ publishHandles: next })}
        tokens={tokens}
      />
      <CheckboxRow
        id="consent-quote"
        label="You may quote what I wrote here."
        checked={consent.quote}
        onChange={(next) => onChange({ quote: next })}
        tokens={tokens}
      />
      <CheckboxRow
        id="consent-attribute"
        label="You may put my handle next to that quote."
        checked={consent.attributeQuote}
        onChange={(next) => onChange({ attributeQuote: next })}
        tokens={tokens}
      />
    </ChoiceGroup>
  );
}

// The survey form itself, shown to a signed-in member. The session is a spam gate only: nothing
// about the account reaches the stored row, and no contact detail is asked for at all.
//
// The consent questions come last and default to no, so nothing is published unless a person
// actively said it could be.
export function QuoraSurveyPublicShell() {
  const { theme } = useTheme();
  const t = getSurveyTokens(theme);

  const nextKey = useRef(1);
  // Starts unanswered rather than at a default, so nobody is recorded as having answered a
  // question they never touched. The send button stays disabled until both required questions
  // carry a real answer.
  const [targetedIndividual, setTargetedIndividual] =
    useState<QuoraSurveyTargetedIndividual | null>(null);
  const [anyAccountRemoved, setAnyAccountRemoved] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<AccountDraft[]>([emptyAccountDraft('0')]);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [otherNotes, setOtherNotes] = useState('');
  const [consent, setConsent] = useState<ConsentState>({
    publishHandles: false,
    quote: false,
    attributeQuote: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ accountCount: number } | null>(null);

  const addAccount = () => {
    const key = String(nextKey.current);
    nextKey.current += 1;
    setAccounts((current) => [...current, emptyAccountDraft(key)]);
  };

  const handleSubmit = async () => {
    // Both required questions have to carry a real answer. The send button is already disabled
    // until they do; this guard means a stray call can never post an assumed answer instead.
    if (targetedIndividual === null || anyAccountRemoved === null) {
      setError('Answer the first two questions before sending.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const outcome = await submitSurvey(
      buildSubmission({
        targetedIndividual,
        anyAccountRemoved,
        accounts,
        evidenceNote,
        otherNotes,
        consentPublishHandles: consent.publishHandles,
        consentQuote: consent.quote,
        consentAttributeQuote: consent.attributeQuote,
      }),
    );
    setSubmitting(false);
    if (outcome.ok) {
      setDone({ accountCount: outcome.accountCount });
      return;
    }
    setError(outcome.message);
  };

  if (done) {
    return <SurveyDone accountCount={done.accountCount} tokens={t} />;
  }

  const blocked = submitting || targetedIndividual === null || anyAccountRemoved === null;

  return (
    <main style={pageStyle(t)}>
      <div style={columnStyle}>
        <SurveyIntro tokens={t} />

        <TargetedIndividualQuestion
          value={targetedIndividual}
          onChange={setTargetedIndividual}
          tokens={t}
        />

        <ChoiceGroup
          legend="Has at least one of your Quora accounts been removed?"
          hint="Removed, banned, suspended, emptied of its answers, or blocked from posting."
          tokens={t}
        >
          <YesNo
            name="any-account-removed"
            value={anyAccountRemoved}
            onChange={setAnyAccountRemoved}
            tokens={t}
          />
        </ChoiceGroup>

        {anyAccountRemoved === true ? (
          <AccountsSection
            accounts={accounts}
            setAccounts={setAccounts}
            onAdd={addAccount}
            tokens={t}
          />
        ) : null}

        <Field
          id="evidence-note"
          label="Anything you can show (optional)"
          hint="The text of the notice Quora sent, or a web.archive.org link to the profile as it was."
          tokens={t}
        >
          <textarea
            id="evidence-note"
            value={evidenceNote}
            onChange={(event) => setEvidenceNote(event.target.value)}
            rows={4}
            style={{ ...inputStyle(t), resize: 'vertical' }}
          />
        </Field>

        <Field id="other-notes" label="Anything else (optional)" tokens={t}>
          <textarea
            id="other-notes"
            value={otherNotes}
            onChange={(event) => setOtherNotes(event.target.value)}
            rows={4}
            style={{ ...inputStyle(t), resize: 'vertical' }}
          />
        </Field>

        <ConsentSection
          consent={consent}
          onChange={(patch) => setConsent((current) => ({ ...current, ...patch }))}
          tokens={t}
        />

        {error ? (
          <p role="alert" style={errorStyle(t)}>
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={blocked}
          style={primaryButtonStyle(t, blocked)}
        >
          {submitting ? 'Sending…' : 'Send my answer'}
        </button>
      </div>
    </main>
  );
}
