import { describe, expect, it } from 'vitest';
import { SE_CLICK_LOG_WORDS, SE_ME_TOOLS, SE_OFFER_CHOICES, SE_OFFER_WHAT_WORKS } from '@ctf/shared';

// + New carries What Works (under Offer) and "Log what happened"; Me → Tools no longer carries the
// latter (owner decisions, 2026-11-16).

describe('+ New entries', () => {
  it('drops Log what happened from Me → Tools', () => {
    expect(SE_ME_TOOLS.map((tool) => tool.key)).not.toContain('click-log');
    expect(SE_ME_TOOLS.map((tool) => tool.label)).not.toContain(SE_CLICK_LOG_WORDS.title);
  });
  it('names the What Works offer apart from the choices that open elsewhere', () => {
    expect(SE_OFFER_WHAT_WORKS.label).toBe('A problem, with what helped');
    expect(SE_OFFER_CHOICES.map((choice) => choice.label)).not.toContain(SE_OFFER_WHAT_WORKS.label);
  });
  it('says the location is filled in as the sheet opens', () => {
    expect(SE_CLICK_LOG_WORDS.open).toBe('Something happened? Log it where you are');
    expect(SE_CLICK_LOG_WORDS.rule.startsWith('Your location is filled in once you allow it.')).toBe(true);
  });
});
