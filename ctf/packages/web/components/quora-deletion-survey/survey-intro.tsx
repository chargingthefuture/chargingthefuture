'use client';

import type { ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import type { SurveyTokens } from './survey-theme';
import { cardStyle, cardTitleStyle, columnStyle, pageStyle } from './survey-styles';
import { hintStyle } from './survey-fields';

// What the person reads before the first question, and what they read after the last one.
//
// The order is deliberate: what this is, what happens to the answers, then what the results can
// and cannot show.
//
// This copy said, until 2026-08-19, that nobody here could tell which member wrote which answer.
// That was wrong for what this survey is (owner): the point is to put handle history on record,
// the handles are public, and someone who does not want theirs recorded does not fill in the form.
// The answer is saved with the account that sent it, and the copy now says so. What the consent
// boxes control — whether any of it is published — is unchanged and is the promise that matters.

export function SurveyIntro({ tokens }: { tokens: SurveyTokens }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <ClipboardList size={22} color={tokens.ACCENT} aria-hidden="true" />
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, color: tokens.TITLE }}>
          Quora account removals
        </h1>
      </div>

      <p style={{ fontSize: 15, lineHeight: 1.65, color: tokens.TEXT }}>
        People writing about being targeted keep losing their Quora accounts. That gets said a lot
        and shown almost never. This form collects what people can actually attest to: which
        accounts were removed, when, and what they were writing about.
      </p>

      <section style={cardStyle(tokens)}>
        <h2 style={cardTitleStyle(tokens)}>What happens to your answers</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.65, color: tokens.TEXT }}>
          <li style={{ marginBottom: 8 }}>
            Your answer is saved with the account you signed in with, so we can tell two answers
            from one person answering twice. No email, no address, no browser details, and the form
            asks for no way to reach you.
          </li>
          <li style={{ marginBottom: 8 }}>
            Nothing is published unless you tick the boxes at the end saying it can be. Those start
            off, and they are what decides whether a handle or a quote of yours ever appears
            anywhere.
          </li>
          <li style={{ marginBottom: 8 }}>
            Counts drawn from these answers may appear in the blog. Handles and quotes only ever
            appear with your permission.
          </li>
          <li style={{ marginBottom: 0 }}>
            If you delete your account, the answer stays and your account id is removed from it.
            The record of an account being erased should not itself be erased.
          </li>
        </ul>
      </section>

      <section style={cardStyle(tokens)}>
        <h2 style={cardTitleStyle(tokens)}>What this can and cannot show</h2>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: tokens.TEXT, margin: '0 0 8px' }}>
          These are self-reports. Nothing is checked against Quora, so the results are what people
          say happened, not a verified audit.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: tokens.TEXT, margin: 0 }}>
          Only someone who found their way somewhere else can answer at all, and only someone
          willing to make an account here can send it. So this counts people who kept going and were
          willing to sign up, and misses everyone else. It is a floor, never a share of everyone
          affected.
        </p>
      </section>
    </>
  );
}

// What a signed-out visitor sees. The same explanation as the form itself, because this link is
// read outside the app and someone deciding whether to make an account should be able to read what
// they would be answering, and what happens to it, before they do.
export function SurveyPublicLanding({
  signInUrl,
  tokens,
}: {
  signInUrl: string;
  tokens: SurveyTokens;
}) {
  return (
    <main style={pageStyle(tokens)}>
      <div style={columnStyle}>
        <SurveyIntro tokens={tokens} />

        <section style={{ ...cardStyle(tokens), borderColor: `${tokens.ACCENT}55` }}>
          <h2 style={cardTitleStyle(tokens)}>Why this one asks you to sign in</h2>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: tokens.TEXT, margin: '0 0 8px' }}>
            An open form on this subject fills up with junk, and junk answers would sit in the same
            table as real ones with no way to tell them apart. A free account is the smallest thing
            that stops it.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: tokens.TEXT, margin: 0 }}>
            Your answer is saved with that account. This survey is a record of handles and writing
            being removed, and the handles in it are public ones you choose to name. Whether any of
            it is published is a separate question, and you answer it yourself at the end.
          </p>
        </section>

        <a
          href={signInUrl}
          style={{
            display: 'block',
            marginTop: 20,
            padding: '15px',
            borderRadius: 12,
            background: tokens.ACCENT,
            color: '#0F1117',
            fontSize: 16,
            fontWeight: 800,
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Sign in or make a free account
        </a>
      </div>
    </main>
  );
}

// The confirmation screen. Takes children so the verification offer can sit under the
// confirmation without this file knowing anything about Unlock — what a person is told about their
// stored answer stays here, and what they are offered next is decided by the shell.
export function SurveyDone({
  accountCount,
  tokens,
  children,
}: {
  accountCount: number;
  tokens: SurveyTokens;
  children?: ReactNode;
}) {
  return (
    <main style={pageStyle(tokens)}>
      <div style={columnStyle}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px', color: tokens.TITLE }}>
          Recorded
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: tokens.TEXT }}>
          {accountCount === 0
            ? 'Your answer is on record. Nothing was published — that only happens for the boxes you ticked.'
            : `${accountCount} account${accountCount === 1 ? '' : 's'} recorded. Nothing was published — that only happens for the boxes you ticked.`}
        </p>
        <p style={hintStyle(tokens)}>
          You can close this page. There is no confirmation message, because the form asks for no
          way to reach you.
        </p>

        {children}
      </div>
    </main>
  );
}
