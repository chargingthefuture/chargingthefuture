'use client';

import { failureText, responseFailureText } from '@/lib/errors/client-failure';
import type { QuoraSurveyTargetedIndividual } from 'lib/quora-deletion-survey/constants';
import type { AccountDraft } from './survey-account-card';

// Turning the form's drafts into the request body, and reporting back what the route said.
//
// Kept beside the shell rather than inside it so the shell stays a description of the page. The
// error text a person sees is whatever the route sent, via the shared failure helpers — never a
// house string written here, which would hide which of several failures actually happened
// (rule 137). The audience is 'member': someone filling in this form is not an operator, so the
// technical reason goes to the error report rather than onto their screen.

export type SurveyFormState = {
  targetedIndividual: QuoraSurveyTargetedIndividual;
  anyAccountRemoved: boolean;
  hasCurrentProfile: boolean | null;
  accounts: AccountDraft[];
  evidenceNote: string;
  otherNotes: string;
  consentPublishHandles: boolean;
  consentQuote: boolean;
  consentAttributeQuote: boolean;
};

export type SubmitOutcome =
  | { ok: true; accountCount: number }
  | { ok: false; message: string };

const SEND_FAILED = 'Your answer could not be sent. Nothing was recorded — please try again.';

// A text box left empty is not a number, and a number box left empty is not a zero. Both become
// null so the stored row says "not answered" rather than inventing an answer.
function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function buildSubmission(state: SurveyFormState): Record<string, unknown> {
  const accounts = state.anyAccountRemoved
    ? state.accounts
        .filter((draft) => draft.handle.trim().length > 0)
        .map((draft) => ({
          handle: draft.handle.trim(),
          action: draft.action,
          removedMonth: optionalNumber(draft.removedMonth),
          removedYear: optionalNumber(draft.removedYear),
          statedReason: draft.statedReason,
          appealed: draft.appealed,
          reinstated: draft.reinstated,
          topics: draft.topics,
          approxPostCount: optionalNumber(draft.approxPostCount),
          approxActiveMonths: optionalNumber(draft.approxActiveMonths),
        }))
    : [];

  return {
    targetedIndividual: state.targetedIndividual,
    anyAccountRemoved: state.anyAccountRemoved,
    // The yes/no travels; the URL that goes with it does not. That link is a verification link
    // and would identify the person who sent this otherwise-unattached answer.
    hasCurrentProfile: state.hasCurrentProfile,
    accounts,
    evidenceNote: state.evidenceNote,
    otherNotes: state.otherNotes,
    consentPublishHandles: state.consentPublishHandles,
    consentQuote: state.consentQuote,
    consentAttributeQuote: state.consentAttributeQuote,
  };
}

export async function submitSurvey(body: Record<string, unknown>): Promise<SubmitOutcome> {
  try {
    const response = await fetch('/api/quora-deletion-survey/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { ok: false, message: await responseFailureText(response, SEND_FAILED, 'member') };
    }

    const payload = (await response.json()) as { accountCount?: number };
    return { ok: true, accountCount: payload.accountCount ?? 0 };
  } catch (error) {
    return {
      ok: false,
      message: failureText(error, {
        area: 'quora-deletion-survey',
        op: 'submit',
        fallback: SEND_FAILED,
        audience: 'member',
      }),
    };
  }
}

export type VerificationOutcome =
  | { ok: true; status: string }
  | { ok: false; message: string };

const VERIFY_FAILED =
  'Verification could not be started. Your survey answer is already recorded — you can verify from the Unlock screen instead.';

// A second, separate request, sent only if the person presses the button on the confirmation
// screen. It carries the link to the account they still hold, and nothing else — the accounts they
// reported as closed were already written to their account history when the answer was stored.
export async function submitVerification(body: {
  quoraProfileUrl: string;
}): Promise<VerificationOutcome> {
  try {
    const response = await fetch('/api/quora-deletion-survey/verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { ok: false, message: await responseFailureText(response, VERIFY_FAILED, 'member') };
    }

    const payload = (await response.json()) as { status?: string };
    return { ok: true, status: payload.status ?? 'submitted' };
  } catch (error) {
    return {
      ok: false,
      message: failureText(error, {
        area: 'quora-deletion-survey',
        op: 'verification-link',
        fallback: VERIFY_FAILED,
        audience: 'member',
      }),
    };
  }
}
