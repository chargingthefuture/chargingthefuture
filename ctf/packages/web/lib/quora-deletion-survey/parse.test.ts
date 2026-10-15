import { describe, expect, it } from 'vitest';
import { parseSurveySubmission } from './parse';

// The removed_year CHECK on quora_deletion_survey_accounts allows 2005-2100. A year the parser
// keeps must be one the insert accepts, or the entire response is lost at the database.
function removedYearFor(year: unknown): number | null | undefined {
  const result = parseSurveySubmission({
    targetedIndividual: 'no',
    anyAccountRemoved: true,
    accounts: [{ handle: 'someone', removedYear: year }],
  });
  if (!result.ok) throw new Error(result.message);
  return result.value.accounts[0]?.removedYear;
}

describe('parseSurveySubmission removedYear', () => {
  it('keeps a year inside the range the table accepts', () => {
    expect(removedYearFor(2010)).toBe(2010);
    expect(removedYearFor(2100)).toBe(2100);
  });

  it('turns a year past the table bound into null rather than letting it reach the insert', () => {
    expect(removedYearFor(2101)).toBeNull();
    expect(removedYearFor(2110)).toBeNull();
  });

  it('turns a year before Quora opened into null', () => {
    expect(removedYearFor(2009)).toBeNull();
  });
});
