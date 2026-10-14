import { describe, expect, it } from 'vitest';
import { buildUnlockHelpAnswer, classifyUnlockHelpQuestion } from './unlock-help-script';
import { summarizeUnlockHelp, describeUnlockHelpDelivery, describeUnlockHelpOutcome, type UnlockHelpLogRow } from './unlock-help-log-format';
import { commonsSuggestionChips } from '../concierge/commons-suggestions';

describe('classifyUnlockHelpQuestion', () => {
  it('sends the plain profile-link question to the browser steps', () => {
    expect(classifyUnlockHelpQuestion("I can't find my Quora profile URL. Where is it?")).toBe('browser');
    expect(classifyUnlockHelpQuestion('where do I get my profile link')).toBe('browser');
  });

  it('picks the way the member is stuck', () => {
    expect(classifyUnlockHelpQuestion("I'm on the Quora app, where is my profile link?")).toBe('quora_app');
    expect(classifyUnlockHelpQuestion('my quora link was rejected')).toBe('wrong_link');
    expect(classifyUnlockHelpQuestion("I can't log in to quora to get my url")).toBe('cannot_sign_in');
    expect(classifyUnlockHelpQuestion("I don't have a Quora account, what link do I use?")).toBe('cannot_sign_in');
  });

  it('leaves other Unlock questions to the model and ignores everything else', () => {
    expect(classifyUnlockHelpQuestion('how long does verification take?')).toBe('model');
    expect(classifyUnlockHelpQuestion('when will I be approved')).toBe('model');
    expect(classifyUnlockHelpQuestion('what is the GDP tracker showing this week?')).toBeNull();
  });
});

describe('buildUnlockHelpAnswer', () => {
  it('numbers the steps and adds the app line to the browser answer', () => {
    const answer = buildUnlockHelpAnswer('browser');
    expect(answer).toContain('1. Open quora.com and sign in.');
    expect(answer).toContain('In the Quora app instead');
  });

  it('points a member who cannot sign in at the hint box, not at Quora', () => {
    const answer = buildUnlockHelpAnswer('cannot_sign_in');
    expect(answer).toContain('Anything that helps me find you on Quora');
    expect(answer).not.toContain('Open quora.com');
  });
});

function row(partial: Partial<UnlockHelpLogRow>): UnlockHelpLogRow {
  return {
    turnId: 't',
    askedAtIso: '2026-09-26T00:00:00.000Z',
    helpCase: 'browser',
    question: 'q',
    userId: 'u',
    username: null,
    reviewStatus: 'pending',
    sentWithoutReview: false,
    answer: null,
    rating: null,
    outcome: 'no_submission',
    daysToApproval: null,
    ...partial,
  };
}

describe('Unlock help log summary', () => {
  it('counts asked, answered, corrected and approved per case', () => {
    const summary = summarizeUnlockHelp([
      row({ reviewStatus: 'approved', sentWithoutReview: true, outcome: 'approved', daysToApproval: 2 }),
      row({ reviewStatus: 'corrected', rating: 'not_helpful' }),
      row({ helpCase: 'model' }),
    ]);
    expect(summary).toEqual([
      { helpCase: 'browser', asked: 2, answered: 2, corrected: 1, notHelpful: 1, approvedAfter: 1 },
      { helpCase: 'model', asked: 1, answered: 0, corrected: 0, notHelpful: 0, approvedAfter: 0 },
    ]);
  });

  it('describes the outcome in words', () => {
    expect(describeUnlockHelpOutcome(row({ outcome: 'approved', daysToApproval: 0 }))).toBe('approved the same day');
    expect(describeUnlockHelpOutcome(row({ outcome: 'approved', daysToApproval: 3 }))).toBe('approved 3 days later');
    expect(describeUnlockHelpOutcome(row({ outcome: 'waiting' }))).toBe('submitted, waiting for review');
  });

  it('says how the answer reached the member', () => {
    expect(describeUnlockHelpDelivery(row({ reviewStatus: 'approved', sentWithoutReview: true, rating: 'not_helpful' }))).toBe('sent without review, rated not helpful');
    expect(describeUnlockHelpDelivery(row({ reviewStatus: 'corrected' }))).toBe('reviewed, corrected');
  });
});

describe('commonsSuggestionChips', () => {
  it('gives a member not yet approved only the Unlock chips', () => {
    expect(commonsSuggestionChips({ unlockFocus: true }).map((chip) => chip.id)).toEqual(['quora-url', 'new-here']);
    expect(commonsSuggestionChips().length).toBeGreaterThan(2);
  });
});
