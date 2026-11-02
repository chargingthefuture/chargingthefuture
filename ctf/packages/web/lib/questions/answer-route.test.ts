import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SE_QUESTIONS } from '@ctf/shared';

// Answering a question never turns 21 Questions matching back on: only the toggle's route writes it.

const { setMatchingEnabled } = vi.hoisted(() => ({ setMatchingEnabled: vi.fn() }));
vi.mock('lib/questions/_lib', () => ({
  ensureMutationCsrf: () => null,
  requireQuestionsAccess: async () => ({ allowed: true, auth: { userId: 'ann' } }),
}));
vi.mock('lib/questions/repository', () => ({
  saveAnswer: vi.fn(async () => true),
  listAnswers: vi.fn(async () => new Map([[SE_QUESTIONS[0].id, 0]])),
  setMatchingEnabled,
}));
vi.mock('lib/security/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }) }));
vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));

import { POST } from '../../app/api/today/questions/answers/route';

describe('POST /api/today/questions/answers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves the answer and leaves matching as it was', async () => {
    const request = new Request('http://localhost/api/today/questions/answers', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ questionId: SE_QUESTIONS[0].id, choice: 0 }),
    });
    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(setMatchingEnabled).not.toHaveBeenCalled();
  });
});
