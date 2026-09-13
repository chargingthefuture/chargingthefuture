import { describe, expect, it } from 'vitest';
import { hasClassStarted } from './repository';

const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

// A class is under way once somebody is teaching it and its start date has arrived. Both halves are
// required: a cohort whose date has passed with nobody teaching has not started, and a cohort with a
// trainer attached but a date still ahead has not started either.
describe('hasClassStarted', () => {
  it('is started when a trainer is attached and the start date has passed', () => {
    expect(hasClassStarted({ assignedTrainerId: 'user_trainer', startDate: YESTERDAY })).toBe(true);
  });

  it('is not started when the date has passed but nobody is teaching it', () => {
    expect(hasClassStarted({ assignedTrainerId: null, startDate: YESTERDAY })).toBe(false);
  });

  it('is not started when a trainer is attached but the date is still ahead', () => {
    expect(hasClassStarted({ assignedTrainerId: 'user_trainer', startDate: TOMORROW })).toBe(false);
  });

  it('is started on the day itself', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(hasClassStarted({ assignedTrainerId: 'user_trainer', startDate: today })).toBe(true);
  });

  // A missing or unreadable date reads as not started, which leaves the learner able to take
  // themselves out. Erring the other way would trap somebody because of a bad row.
  it('is not started when the cohort has no start date', () => {
    expect(hasClassStarted({ assignedTrainerId: 'user_trainer', startDate: null })).toBe(false);
  });

  it('is not started when the start date cannot be read', () => {
    expect(hasClassStarted({ assignedTrainerId: 'user_trainer', startDate: 'not-a-date' })).toBe(false);
  });
});
