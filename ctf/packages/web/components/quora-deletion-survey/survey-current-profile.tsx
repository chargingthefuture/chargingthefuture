'use client';

import { useState } from 'react';
import type { SurveyTokens } from './survey-theme';
import { ChoiceGroup, Field, YesNo, hintStyle, inputStyle } from './survey-fields';
import { cardStyle, cardTitleStyle, errorStyle, primaryButtonStyle } from './survey-styles';
import { submitVerification } from './survey-submit';

// The optional question about an account the person still holds, and the offer that follows it on
// the confirmation screen.
//
// Why these live together: the yes/no is stored with the response, the URL is not. It is held in
// the browser and only sent anywhere if the person presses the button below. That is not about
// hiding them — the response carries their member id — it is that a verification URL belongs in
// the verification queue, where a reviewer acts on it, rather than sitting in a research table
// nobody re-reads.

export function CurrentProfileQuestion({
  hasCurrentProfile,
  onHasCurrentProfileChange,
  url,
  onUrlChange,
  tokens,
}: {
  hasCurrentProfile: boolean | null;
  onHasCurrentProfileChange: (next: boolean) => void;
  url: string;
  onUrlChange: (next: string) => void;
  tokens: SurveyTokens;
}) {
  return (
    <>
      <ChoiceGroup
        legend="Do you have a Quora account now that has not been removed? (optional)"
        hint="You can skip this. Naming an account you still have is a bigger ask than naming ones already gone, and skipping it changes nothing about the answer you just gave."
        tokens={tokens}
      >
        <YesNo
          name="has-current-profile"
          value={hasCurrentProfile}
          onChange={onHasCurrentProfileChange}
          tokens={tokens}
        />
      </ChoiceGroup>

      {hasCurrentProfile === true ? (
        <Field
          id="current-profile-url"
          label="Link to that account (optional)"
          hint="Only used if you choose to start verification on the next screen. It goes to the verification queue, not into your survey answer."
          tokens={tokens}
        >
          <input
            id="current-profile-url"
            type="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://www.quora.com/profile/..."
            style={inputStyle(tokens)}
          />
        </Field>
      ) : null}
    </>
  );
}

type OfferState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; alreadyOnFile: boolean }
  | { kind: 'error'; message: string };

// Shown on the confirmation screen, and only when all three of these hold: the person said they
// still have an account, they gave its link, and this member has no Unlock submission yet.
//
// Verification is the ordinary way into the rest of the app, and the link they just typed is the
// same thing the Unlock screen would ask for. Offering it here saves asking twice. It creates a
// pending submission for the owner to review — it approves nobody.
export function VerificationOffer({
  quoraProfileUrl,
  removedHandles,
  tokens,
}: {
  quoraProfileUrl: string;
  removedHandles: string[];
  tokens: SurveyTokens;
}) {
  const [state, setState] = useState<OfferState>({ kind: 'idle' });

  const send = async () => {
    setState({ kind: 'sending' });
    const outcome = await submitVerification({ quoraProfileUrl, removedHandles });
    if (outcome.ok) {
      setState({ kind: 'done', alreadyOnFile: outcome.status === 'already_on_file' });
      return;
    }
    setState({ kind: 'error', message: outcome.message });
  };

  if (state.kind === 'done') {
    return (
      <section style={cardStyle(tokens)}>
        <h2 style={cardTitleStyle(tokens)}>Verification</h2>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: tokens.TEXT, margin: 0 }}>
          {state.alreadyOnFile
            ? 'You already had an account link on file, so nothing was changed.'
            : 'Your link is in the review queue. Nobody is approved automatically — someone reads it and decides.'}
        </p>
      </section>
    );
  }

  return (
    <section style={{ ...cardStyle(tokens), borderColor: `${tokens.ACCENT}55` }}>
      <h2 style={cardTitleStyle(tokens)}>Use that link to finish verification?</h2>
      <p style={{ fontSize: 14, lineHeight: 1.65, color: tokens.TEXT, margin: '0 0 10px' }}>
        Getting into the rest of this app means showing a Quora account, which is the link you just
        typed. Sending it now saves being asked for the same thing again. It goes into a queue for a
        person to read; it approves nothing by itself.
      </p>
      {removedHandles.length > 0 ? (
        <p style={hintStyle(tokens)}>
          The accounts you listed as lost — {removedHandles.join(', ')} — are recorded on your
          profile as accounts you had, alongside the one you are verifying with. That is the point
          of this: your account history in one place rather than scattered across removals.
        </p>
      ) : null}

      {state.kind === 'error' ? (
        <p role="alert" style={errorStyle(tokens)}>
          {state.message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={send}
        disabled={state.kind === 'sending'}
        style={primaryButtonStyle(tokens, state.kind === 'sending')}
      >
        {state.kind === 'sending' ? 'Sending…' : 'Send my link for verification'}
      </button>
    </section>
  );
}
