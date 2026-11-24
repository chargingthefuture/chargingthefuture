import { describe, expect, it } from 'vitest';
import { seStoryCardBody, seStoryOpening, seStoryPostHref } from '@ctf/shared';

describe('a blog story card body', () => {
  it('is the post teaser where the blog gives one', () => {
    expect(seStoryCardBody({ text: 'The blog has a new page: https://example.org/a\n\nMore.', teaser: '  A short   version of the post. ' })).toBe('A short version of the post.');
  });

  it('takes bare addresses out of a teaser', () => {
    expect(seStoryCardBody({ text: 'x', teaser: 'Read it at https://example.org/a today.' })).toBe('Read it at today.');
  });

  it('takes out an address that runs on from a word, a www address and one with no prefix', () => {
    expect(seStoryCardBody({ text: 'x', teaser: 'Please joinhttps://tiskillsnetwork.quora.com/' })).toBe('Please join');
    expect(seStoryCardBody({ text: 'x', teaser: 'Try www.example.com/plan for a phone.' })).toBe('Try for a phone.');
    expect(seStoryCardBody({ text: 'x', teaser: 'An obvious one is here: qr.ae/pYRtmI and more.' })).toBe('An obvious one is here: and more.');
  });

  it('keeps a site name with no path, which reads as a name', () => {
    expect(seStoryCardBody({ text: 'x', teaser: 'The front page at lagatos.com lets anybody look.' })).toBe('The front page at lagatos.com lets anybody look.');
  });

  it('falls back to the opening when the teaser is missing or holds only an address', () => {
    const text = 'The blog has a new page: https://chargingthefuture.github.io/chargingthefuture/article/x\n\nIt is about rides and rooms.';
    expect(seStoryCardBody({ text })).toBe('It is about rides and rooms.');
    expect(seStoryCardBody({ text, teaser: 'https://example.org' })).toBe('It is about rides and rooms.');
  });

  it('keeps a link label and drops its address in the opening', () => {
    expect(seStoryOpening('See the Dictionary (https://example.org/d) for the words.')).toBe('See the Dictionary for the words.');
  });

  it('cuts a long opening at a word', () => {
    const opening = seStoryOpening(`${'word '.repeat(80)}end`, 40);
    expect(opening.endsWith('…')).toBe(true);
    expect(opening.length).toBeLessThanOrEqual(41);
  });
});

describe('the post a story card opens', () => {
  it('is the address of a blog story only', () => {
    expect(seStoryPostHref({ source: 'blog-story', href: 'https://example.org/p' })).toBe('https://example.org/p');
    expect(seStoryPostHref({ source: 'member-story', href: '' })).toBeNull();
    expect(seStoryPostHref({ source: 'blog-story', href: '/' })).toBeNull();
    expect(seStoryPostHref({ source: 'trust-transport', href: 'https://example.org' })).toBeNull();
  });
});
