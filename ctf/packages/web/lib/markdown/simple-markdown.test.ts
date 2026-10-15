import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, safeHref } from './simple-markdown';

describe('parseMarkdown', () => {
  it('joins hard-wrapped lines into one paragraph and splits on blank lines', () => {
    const blocks = parseMarkdown('One line\nwrapped here.\n\nSecond paragraph.');
    expect(blocks).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'One line wrapped here.' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Second paragraph.' }] },
    ]);
  });

  it('reads headings, lists, quotes and rules', () => {
    const blocks = parseMarkdown('## What they do\n\n- Plumbing\n- Wiring\n\n1. First\n2. Second\n\n> Quoted words\n\n---');
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'list', 'list', 'quote', 'rule']);
    const lists = blocks.filter((block) => block.type === 'list');
    expect(lists.map((list) => list.type === 'list' && list.ordered)).toEqual([false, true]);
  });

  it('keeps a tag in the text as text', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>');
    expect(blocks).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: '<script>alert(1)</script>' }] }]);
  });
});

describe('parseInline', () => {
  it('reads links, bold, italic and code', () => {
    expect(parseInline('See [the listing](/apps/directory) and **this** with *that* and `code`.')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', href: '/apps/directory', children: [{ type: 'text', text: 'the listing' }] },
      { type: 'text', text: ' and ' },
      { type: 'strong', children: [{ type: 'text', text: 'this' }] },
      { type: 'text', text: ' with ' },
      { type: 'em', children: [{ type: 'text', text: 'that' }] },
      { type: 'text', text: ' and ' },
      { type: 'code', text: 'code' },
      { type: 'text', text: '.' },
    ]);
  });

  it('links a bare address and leaves the sentence punctuation outside it', () => {
    expect(parseInline('Sam (https://www.quora.com/profile/Sam-1).')).toEqual([
      { type: 'text', text: 'Sam (' },
      { type: 'link', href: 'https://www.quora.com/profile/Sam-1', children: [{ type: 'text', text: 'https://www.quora.com/profile/Sam-1' }] },
      { type: 'text', text: ').' },
    ]);
  });

  it('keeps the words of a link it will not follow, and turns a picture into its alt text', () => {
    expect(parseInline('[click](javascript:alert(1))')).toEqual([
      { type: 'text', text: 'click' },
      { type: 'text', text: ')' },
    ]);
    expect(parseInline('![What Sam wrote](../images/sam.png)')).toEqual([{ type: 'text', text: 'What Sam wrote' }]);
  });

  it('does not read underscores inside a handle as italic', () => {
    expect(parseInline('handle snake_case_name here')).toEqual([{ type: 'text', text: 'handle snake_case_name here' }]);
  });
});

describe('safeHref', () => {
  it('follows web, mail and in-app addresses only', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com');
    expect(safeHref('/apps/directory')).toBe('/apps/directory');
    expect(safeHref('//evil.example')).toBeNull();
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,x')).toBeNull();
  });
});
