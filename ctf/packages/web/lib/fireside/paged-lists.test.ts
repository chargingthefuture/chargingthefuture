import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Every paged list in Fireside keeps its page in the address bar through one hook. Two things went
// wrong there. Adopting the page the server clamped to pushed a second history entry, so Back landed
// on the out-of-range page, which clamped and pushed again, and Back never left the list. And each
// list fetched page 1 before the address bar was read, so a link to page 3 sent two requests whose
// answers could land out of order.
const componentsRoot = join(__dirname, '..', '..', 'components', 'fireside');
const hookSource = readFileSync(join(componentsRoot, 'fireside-url-page.ts'), 'utf8');

const LISTS = [
  'fireside-shell.tsx',
  'fireside-search.tsx',
  'fireside-admin-comments.tsx',
  'fireside-admin-threads.tsx',
  'fireside-export-queue.tsx',
];

const READ_SCREENS = [
  'fireside-shell.tsx',
  'fireside-thread-view.tsx',
  'fireside-admin-comments.tsx',
  'fireside-admin-threads.tsx',
  'fireside-admin-audit.tsx',
  'fireside-export-queue.tsx',
];

describe('the page hook', () => {
  it('replaces the history entry for a clamped page and pushes only for a chosen one', () => {
    expect(hookSource).toContain('window.history.replaceState(');
    expect(hookSource).toContain('const setPage = useCallback((next: number) => writePage(next, "push")');
    expect(hookSource).toContain('const adoptPage = useCallback((next: number) => writePage(next, "replace")');
  });

  it('says when the address bar has been read', () => {
    expect(hookSource).toContain('setReady(true);');
  });
});

describe.each(LISTS)('%s', (file) => {
  const source = readFileSync(join(componentsRoot, file), 'utf8');

  it('adopts the server-clamped page without adding a history entry', () => {
    expect(source).toMatch(/!== wanted\) adoptPage\(/);
    expect(source).not.toMatch(/!== wanted\) setPage\(/);
  });

  it('does not fetch until the address bar has been read', () => {
    expect(source).toMatch(/useEffect\(\(\) => \{ if \(ready\) void load\(/);
  });
});

describe.each(READ_SCREENS)('%s', (file) => {
  const source = readFileSync(join(componentsRoot, file), 'utf8');

  it('never reads a body without a fallback for one that is not JSON', () => {
    expect(source).not.toContain('await res.json())');
  });
});
