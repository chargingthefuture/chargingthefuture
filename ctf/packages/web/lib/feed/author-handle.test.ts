import { describe, it, expect } from 'vitest';
import { extractMentionHandles } from './author-handle';

// extractMentionHandles is the inverse of the "@ Mentions" filter: it decides who a Commons post
// addresses so those members can be notified. These cases lock the boundaries that matter — an email
// is not a mention, @comic is the AI Assistant (not a member), and a member mentioned twice is
// notified once.
describe('extractMentionHandles', () => {
  it('pulls a plain @username mention', () => {
    expect(extractMentionHandles('welcome @farah, glad you are here')).toEqual(['farah']);
  });

  it('pulls the @user-<token> pseudonym form', () => {
    expect(extractMentionHandles('agreed @user-3gysu61f')).toEqual(['user-3gysu61f']);
  });

  it('captures several handles in one body', () => {
    expect(extractMentionHandles('@ana and @ben-r should see this @user-90ab12cd')).toEqual([
      'ana',
      'ben-r',
      'user-90ab12cd',
    ]);
  });

  it('does not treat an email address as a mention', () => {
    expect(extractMentionHandles('reach me at name@example.com')).toEqual([]);
  });

  it('drops @comic (that routes to the AI Assistant, not a member)', () => {
    expect(extractMentionHandles('@comic what is this @comic')).toEqual([]);
  });

  it('de-duplicates the same handle case-insensitively, keeping the first spelling', () => {
    expect(extractMentionHandles('@Farah again @farah and @FARAH')).toEqual(['Farah']);
  });

  it('returns nothing for a body with no mentions', () => {
    expect(extractMentionHandles('just a normal post')).toEqual([]);
    expect(extractMentionHandles('')).toEqual([]);
  });
});
