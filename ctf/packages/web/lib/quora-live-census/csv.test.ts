import { describe, expect, it } from 'vitest';
import { csvCell } from './csv';

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

  it('leaves dates, numbers and empty cells as they were', () => {
    expect(csvCell('2026-08-19')).toBe('"2026-08-19"');
    expect(csvCell(2024)).toBe('"2024"');
    expect(csvCell(null)).toBe('""');
  });
});
