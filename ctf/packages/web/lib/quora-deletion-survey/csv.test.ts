import { describe, expect, it } from 'vitest';
import { DELETED_MEMBER_PLACEHOLDER } from 'lib/account/deletion-registry';
import { csvCell, renderSurveyCsv } from './csv';
import type { SurveyResponseWithAccounts } from './repository';

function response(overrides: Partial<SurveyResponseWithAccounts>): SurveyResponseWithAccounts {
  return {
    id: 'response-1',
    user_id: 'user_abc',
    targeted_individual: 'no',
    any_account_removed: false,
    has_current_profile: null,
    evidence_note: null,
    other_notes: null,
    consent_publish_handles: false,
    consent_quote: false,
    consent_attribute_quote: false,
    created_at: '2026-10-01T00:00:00.000Z',
    accounts: [],
    ...overrides,
  };
}

describe('csvCell', () => {
  it('quotes plain text and doubles embedded quotes', () => {
    expect(csvCell('say "hi", then go')).toBe('"say ""hi"", then go"');
  });

  it.each(['=HYPERLINK("https://example.com","x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'prefixes a single quote to text a spreadsheet would run as a formula: %j',
    (value) => {
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    },
  );

  it('leaves numbers, booleans and empty cells as they were', () => {
    expect(csvCell(2024)).toBe('"2024"');
    expect(csvCell(true)).toBe('"true"');
    expect(csvCell(null)).toBe('""');
  });
});

describe('renderSurveyCsv member_id', () => {
  it('writes the member id for a current account', () => {
    const [, row] = renderSurveyCsv([response({})]).split('\r\n');
    expect(row.split(',')[1]).toBe('"user_abc"');
  });

  it('leaves member_id empty for an account deleted through the engine placeholder', () => {
    const [, row] = renderSurveyCsv([response({ user_id: DELETED_MEMBER_PLACEHOLDER })]).split('\r\n');
    expect(row.split(',')[1]).toBe('""');
  });

  it('neutralizes a formula in member-typed notes', () => {
    const csv = renderSurveyCsv([response({ other_notes: '=cmd|calc' })]);
    expect(csv).toContain(`"'=cmd|calc"`);
  });
});
