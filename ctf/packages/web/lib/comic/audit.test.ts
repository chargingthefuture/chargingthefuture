import { describe, expect, it } from 'vitest';
import { reviewActionFailure } from './audit';

describe('reviewActionFailure', () => {
  it('records a missing item as a refusal', () => {
    expect(reviewActionFailure('review_not_found')).toEqual({ status: 'deny', errorCategory: 'not_found' });
  });

  it('records an item somebody else already decided as a refusal', () => {
    expect(reviewActionFailure('review_already_resolved')).toEqual({ status: 'deny', errorCategory: 'already_reviewed' });
  });

  it('records an invalid payload code only when the caller names it', () => {
    const invalid = new Set(['correction_required']);
    expect(reviewActionFailure('correction_required', invalid)).toEqual({ status: 'deny', errorCategory: 'invalid_payload' });
    expect(reviewActionFailure('correction_required')).toEqual({ status: 'allow', errorCategory: 'persistence_error' });
  });

  it('records anything else as a failed write', () => {
    expect(reviewActionFailure('connection reset')).toEqual({ status: 'allow', errorCategory: 'persistence_error' });
  });
});
