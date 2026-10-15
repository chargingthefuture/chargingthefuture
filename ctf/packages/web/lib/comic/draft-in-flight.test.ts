import { describe, expect, it } from 'vitest';
import { runDraftOnce, type DraftOutcome } from './draft-in-flight';

describe('runDraftOnce', () => {
  it('joins a draft already running for the same review instead of starting another', async () => {
    let calls = 0;
    let finish: (outcome: DraftOutcome) => void = () => {};
    const run = () => {
      calls += 1;
      return new Promise<DraftOutcome>((resolve) => {
        finish = resolve;
      });
    };
    const first = runDraftOnce('review-a', run);
    const second = runDraftOnce('review-a', run);
    finish({ attached: true, reason: null });
    await expect(first).resolves.toEqual({ attached: true, reason: null });
    await expect(second).resolves.toEqual({ attached: true, reason: null });
    expect(calls).toBe(1);
  });

  it('starts a new draft once the previous one has finished', async () => {
    let calls = 0;
    const run = async (): Promise<DraftOutcome> => {
      calls += 1;
      return { attached: false, reason: 'timeout' };
    };
    await runDraftOnce('review-b', run);
    await runDraftOnce('review-b', run);
    expect(calls).toBe(2);
  });
});
