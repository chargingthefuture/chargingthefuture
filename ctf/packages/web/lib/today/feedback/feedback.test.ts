import { describe, expect, it } from 'vitest';
import { seParseTodayFeedback, seTodayFeedbackFor } from '@ctf/shared';
import { feedbackLines, feedbackText } from './report';

describe('Today card feedback body', () => {
  it('takes a known kind, a source name and a known signal', () => {
    expect(seParseTodayFeedback({ source: 'socket-relay', kind: 'ask', signal: 'done' })).toEqual({ source: 'socket-relay', kind: 'ask', signal: 'done' });
    expect(seTodayFeedbackFor({ source: 'blog-story', kind: 'story' }, 'not_for_me')).toEqual({ source: 'blog-story', kind: 'story', signal: 'not_for_me' });
  });

  it('refuses an unknown kind, signal or a source that is not a source name', () => {
    expect(seParseTodayFeedback({ source: 'socket-relay', kind: 'rant', signal: 'done' })).toBeNull();
    expect(seParseTodayFeedback({ source: 'socket-relay', kind: 'ask', signal: 'hidden' })).toBeNull();
    expect(seParseTodayFeedback({ source: 'Socket Relay', kind: 'ask', signal: 'done' })).toBeNull();
    expect(seParseTodayFeedback({ source: 'a'.repeat(41), kind: 'ask', signal: 'done' })).toBeNull();
    expect(seParseTodayFeedback({ kind: 'ask', signal: 'done' })).toBeNull();
    expect(seParseTodayFeedback(null)).toBeNull();
  });
});

describe('the Adoption section lines', () => {
  it('adds the share that is Not for me and puts the most marks first', () => {
    const lines = feedbackLines([
      { source: 'blog-story', kind: 'story', done: 1, notForMe: 3 },
      { source: 'socket-relay', kind: 'ask', done: 9, notForMe: 1 },
      { source: 'mood', kind: 'mood', done: 0, notForMe: 0 },
    ]);
    expect(lines.map((l) => [l.source, l.total, l.notForMeShare])).toEqual([
      ['socket-relay', 10, 10],
      ['blog-story', 4, 75],
    ]);
    expect(feedbackText(lines, 30).split('\n')[1]).toBe('socket-relay · ask: 9 done, 1 not for me (10% not for me)');
    expect(feedbackText([], 30)).toContain('No cards marked yet.');
  });
});
