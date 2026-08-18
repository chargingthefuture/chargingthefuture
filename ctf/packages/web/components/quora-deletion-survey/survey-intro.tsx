'use client';

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
            No sign-in, no email, no way for anyone here to contact you afterward. Your address and
            browser are not stored.
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
          Only someone who found their way somewhere else can answer at all, so this counts people
          who kept going and misses the ones who did not. It is a floor, never a share of everyone
          affected.
        </p>
      </section>
    </>
  );
}

export function SurveyDone({ accountCount, tokens }: { accountCount: number; tokens: SurveyTokens }) {
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
          You can close this page. There is no confirmation message, because the form asks for no
          way to reach you.
        </p>
      </div>
    </main>
  );
}
