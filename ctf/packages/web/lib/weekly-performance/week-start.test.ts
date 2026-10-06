import { describe, expect, it } from 'vitest';
import { weekStartProblem } from './week-start';

describe('weekStartProblem', () => {
  it('accepts a Monday', () => {
    expect(weekStartProblem('weekStartDate', '2026-10-05')).toBeNull();
  });

  it('refuses a value that is not an ISO date', () => {
    expect(weekStartProblem('weekStartDate', 'abc')).toMatch(/weekStartDate must be an ISO date/);
  });

  it('refuses a date that does not exist', () => {
    expect(weekStartProblem('compareWeekStartDate', '2026-02-30')).toMatch(/compareWeekStartDate is not a real calendar date/);
  });

  it('refuses a real date that is not a Monday', () => {
    expect(weekStartProblem('weekStartDate', '2026-10-07')).toMatch(/is not a Monday/);
  });
});
