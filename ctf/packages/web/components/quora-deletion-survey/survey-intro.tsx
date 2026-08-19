'use client';

import type { ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import type { SurveyTokens } from './survey-theme';
import { cardStyle, cardTitleStyle, columnStyle, pageStyle } from './survey-styles';
import { hintStyle } from './survey-fields';

// What the person reads before the first question, and what they read after the last one.
//
// The order is deliberate: what this is, what happens to the answers, then what the results can
// and cannot show. Someone whose account was taken for writing about being targeted has every
// reason to want the second of those settled before typing a handle.

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
            Signing in keeps out bulk junk, and that is all it does. Your answer is stored with no
            link to your account — no name, no email, no address, no browser. Nobody here can tell
            afterward which member wrote which answer.
          </li>
          <li style={{ marginBottom: 8 }}>
            Nothing is published unless you tick the boxes at the end saying it can be. Those start
            off.
          </li>
          <li style={{ marginBottom: 0 }}>
            Counts drawn from these answers may appear in the blog. Handles and quotes only ever
            appear with your permission.
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
            It is not used to identify you. Your answer is saved with nothing linking it back to the
            account you signed in with.
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
            ? 'Your answer is on record. Nothing was published, and nothing about you was stored beyond what you typed.'
            : `${accountCount} account${accountCount === 1 ? '' : 's'} recorded. Nothing was published, and nothing about you was stored beyond what you typed.`}
        </p>
        <p style={hintStyle(tokens)}>
          You can close this page. There is no confirmation message, because nothing here is
          attached to your account and the form asks for no way to reach you.
        </p>

        {children}
      </div>
    </main>
  );
}
