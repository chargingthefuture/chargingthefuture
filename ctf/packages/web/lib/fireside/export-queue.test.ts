import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The blog-export queue used to answer two questions with two queries that did not agree.
//
// The count was plain SQL with the three column conditions. The list ran the same SQL and then
// dropped, in TypeScript, every request whose author is not approved in Unlock — because an
// unapproved member's words are not publicly visible in the app yet, so there is nothing to decide
// about publishing them further. A request from somebody still waiting was therefore counted and
// never shown: the screen read "1 of 3" over an empty list, and paging past it stayed empty,
// because LIMIT and OFFSET had been spent on rows that were then thrown away.
//
// The fix is that there is one function, so the two cannot disagree again. These tests hold that
// shape, since a fake database would not notice a count and a list drifting apart.
const exportSource = readFileSync(join(__dirname, 'export-review.ts'), 'utf8');
const routeSource = readFileSync(
  join(__dirname, '..', '..', 'app', 'api', 'fireside', 'admin', 'export-queue', 'route.ts'),
  'utf8',
);

describe('the queue counts what it lists', () => {
  it('has one function for the count, the clamp and the page', () => {
    expect(exportSource).toContain('export async function readPendingExportQueue');
    expect(exportSource).not.toContain('export async function countPendingExportRequests');
    expect(exportSource).not.toContain('export async function listPendingExportRequests');
  });

  it('counts after the approval filter, not before it', () => {
    const queue = exportSource.slice(exportSource.indexOf('export async function readPendingExportQueue'));
    const filter = queue.indexOf('const waiting = result.rows.filter');
    const total = queue.indexOf('const total = waiting.length');
    expect(filter).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(filter);
  });

  it('takes the page out of the filtered list rather than out of the query', () => {
    const queue = exportSource.slice(exportSource.indexOf('export async function readPendingExportQueue'));
    // No LIMIT/OFFSET in the scan: a page cut before the filter comes back short or empty while
    // later pages still hold rows.
    const sql = queue.slice(queue.indexOf('queryDb'), queue.indexOf('const approved'));
    expect(sql).not.toContain('LIMIT');
    expect(sql).not.toContain('OFFSET');
    expect(queue).toContain('waiting.slice(offset, offset + input.pageSize)');
  });

  it('clamps a page past the end to the last one', () => {
    const queue = exportSource.slice(exportSource.indexOf('export async function readPendingExportQueue'));
    expect(queue).toContain('Math.min(Math.max(input.page, 1), lastPage)');
  });

  it('is the route’s only source for the queue', () => {
    expect(routeSource).toContain('readPendingExportQueue');
    expect(routeSource).not.toContain('countPendingExportRequests');
  });
});
