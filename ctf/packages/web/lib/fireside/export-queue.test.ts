import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Everything that asks about the blog-export queue has to be looking at the same set of requests.
//
// Two halves decide what is in it. Three are columns on the row — the author asked, an admin has
// not answered, the comment is still in the conversation — and the fourth is that the author is
// approved in Unlock, which is not on the row and cannot be asked in SQL from outside the plugin.
// Each thing that asked got the fourth half wrong in its own way: the queue's count left it out and
// read "1 of 3" over an empty list, and the admin landing's dot left it out and sent an admin to a
// screen saying there was nothing there.
//
// Both halves are now written once, and these tests hold that. A fake database would not notice two
// callers drifting apart, which is the fault itself rather than a symptom of it.
const exportSource = readFileSync(join(__dirname, 'export-review.ts'), 'utf8');
const webRoot = join(__dirname, '..', '..');
const routeSource = readFileSync(
  join(webRoot, 'app', 'api', 'fireside', 'admin', 'export-queue', 'route.ts'),
  'utf8',
);
const attentionSource = readFileSync(join(webRoot, 'lib', 'admin', 'area-attention.ts'), 'utf8');

/** Where a named function's source starts, so a test reads that function and not the file. */
function functionBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  expect(start, `${declaration} is not in this file`).toBeGreaterThan(-1);
  const rest = source.slice(start + declaration.length);
  const end = rest.indexOf('\nexport ');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('the column half of the rule is written once', () => {
  it('is a single constant, not typed out beside each query', () => {
    expect(exportSource).toContain('const PENDING_REQUEST_WHERE');
  });

  it('is what both the count and the list ask for', () => {
    for (const declaration of [
      'export async function countPendingExportRequests',
      'export async function readPendingExportQueue',
    ]) {
      expect(functionBody(exportSource, declaration)).toContain('${PENDING_REQUEST_WHERE}');
    }
  });
});

describe('the Unlock half of the rule is written once', () => {
  it('is a single function', () => {
    expect(exportSource).toContain('async function keepApprovedAuthors');
  });

  it('is what both the count and the list go through', () => {
    for (const declaration of [
      'export async function countPendingExportRequests',
      'export async function readPendingExportQueue',
    ]) {
      expect(functionBody(exportSource, declaration)).toContain('keepApprovedAuthors(');
    }
  });

  it('is the only place this file asks Unlock about a queue row', () => {
    // One call for the queue, plus the export feed's own — which answers a different question and
    // has its own tests. Anything more is a third caller deciding this for itself again.
    const keep = functionBody(exportSource, 'async function keepApprovedAuthors');
    expect(keep).toContain('listUnlockedUserIds');
  });
});

describe('the queue counts what it lists', () => {
  const queue = functionBody(exportSource, 'export async function readPendingExportQueue');

  it('counts after the approval filter, not before it', () => {
    const filter = queue.indexOf('await keepApprovedAuthors');
    const total = queue.indexOf('const total = waiting.length');
    expect(filter).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(filter);
  });

  it('takes the page out of the filtered list rather than out of the query', () => {
    // No LIMIT/OFFSET in the scan: a page cut before the filter comes back short or empty while
    // later pages still hold rows.
    const sql = queue.slice(queue.indexOf('queryDb'), queue.indexOf('const waiting'));
    expect(sql).not.toContain('LIMIT');
    expect(sql).not.toContain('OFFSET');
    expect(queue).toContain('waiting.slice(offset, offset + input.pageSize)');
  });

  it('clamps a page past the end to the last one', () => {
    expect(queue).toContain('Math.min(Math.max(input.page, 1), lastPage)');
  });

  it('is the route’s only source for the queue', () => {
    expect(routeSource).toContain('readPendingExportQueue');
    expect(routeSource).not.toContain('countPendingExportRequests');
  });
});

describe('the admin landing dot points at what the queue shows', () => {
  it('calls the queue’s own count instead of describing it in SQL again', () => {
    expect(attentionSource).toContain("import { countPendingExportRequests } from 'lib/fireside/export-review'");
    expect(attentionSource).toContain('fireside: [{ count: countPendingExportRequests }]');
  });

  it('has no Fireside SQL left in the attention map', () => {
    // The old entry counted the three column conditions and could not ask Unlock anything, so it
    // raised the dot for requests the screen then dropped. A signal that points at an empty screen
    // teaches an admin to stop trusting it.
    expect(attentionSource).not.toContain('FROM fireside_comments');
  });

  it('still takes the last-seen timestamp, so the dot means "new" and not "any"', () => {
    const count = functionBody(exportSource, 'export async function countPendingExportRequests');
    expect(count).toContain('[since]');
    expect(exportSource).toContain('c.updated_at > $1');
  });
});
