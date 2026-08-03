import { describe, it, expect } from 'vitest';
import { canSendInChannel, describeSendBlock, describeStreamSendFailure } from './stream-chat-send-state';

// These helpers decide what a member is told when a chat message will not send. The behavior that
// matters: a composer is never taken away on incomplete data, a refusal always keeps the reason Stream
// gave, and a member never sees only the word "Unauthorized" (the owner-reported failure).

describe('canSendInChannel', () => {
  it('allows sending when Stream lists the send-message capability', () => {
    expect(canSendInChannel({ data: { own_capabilities: ['read-channel', 'send-message'] } })).toBe(true);
  });

  it('blocks sending when the capability list omits send-message', () => {
    expect(canSendInChannel({ data: { own_capabilities: ['read-channel'] } })).toBe(false);
  });

  it('allows sending when no capability list came back, so a working composer is never removed', () => {
    expect(canSendInChannel({ data: {} })).toBe(true);
    expect(canSendInChannel({})).toBe(true);
    expect(canSendInChannel(null)).toBe(true);
  });
});

describe('describeSendBlock', () => {
  it('says nothing when the member can post', () => {
    expect(describeSendBlock({ data: { own_capabilities: ['send-message'] } })).toBeNull();
  });

  it('names a paused conversation as paused, not as the other person going quiet', () => {
    const notice = describeSendBlock({ data: { own_capabilities: [], frozen: true } });
    expect(notice).toContain('paused');
  });

  it('calls any other loss of posting rights a fault, with a next step', () => {
    const notice = describeSendBlock({ data: { own_capabilities: [] } });
    expect(notice).toContain('fault');
    expect(notice).toContain('bug button');
  });
});

describe('describeStreamSendFailure', () => {
  it('keeps the reason Stream gave on a refused send', () => {
    const failure = describeStreamSendFailure({
      status: 403,
      code: 17,
      response: { data: { code: 17, message: 'channel is frozen', StatusCode: 403 } },
    });
    expect(failure.memberText).toContain('channel is frozen');
    expect(failure.detail).toMatchObject({ status: 403, streamCode: 17, streamMessage: 'channel is frozen' });
  });

  it('still explains a refusal that arrived without a reason', () => {
    const failure = describeStreamSendFailure({ status: 403 });
    expect(failure.memberText).toContain('refused');
    expect(failure.memberText).toContain('bug button');
  });

  it('tells the member to wait when messages are going out too fast', () => {
    expect(describeStreamSendFailure({ status: 429 }).memberText).toContain('too fast');
  });

  it('falls back to a connection message for a failure with no status', () => {
    expect(describeStreamSendFailure(new Error('Network Error')).memberText).toContain('Network Error');
    expect(describeStreamSendFailure(undefined).memberText).toContain('try again');
  });
});
