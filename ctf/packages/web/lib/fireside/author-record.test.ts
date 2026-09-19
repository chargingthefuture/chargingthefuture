import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The record beside each blog-export request exists so an admin can answer the account rather than
// the comment — moderating item by item is a losing race against somebody doing it on purpose.
//
// Every number on it was Fireside's own, which left the decision half-informed: an account being a
// problem in several parts of the app at once did not appear here at all. `account_restrictions` is
// the app's single record of an account somebody has already acted on, wherever they acted.
const exportSource = readFileSync(join(__dirname, 'export-review.ts'), 'utf8');
const webRoot = join(__dirname, '..', '..');
const restrictionsSource = readFileSync(
  join(webRoot, 'lib', 'auth', 'account-restrictions.ts'),
  'utf8',
);
const queueSource = readFileSync(
  join(webRoot, 'components', 'fireside', 'fireside-export-queue.tsx'),
  'utf8',
);

function functionBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  expect(start, `${declaration} is not in this file`).toBeGreaterThan(-1);
  const rest = source.slice(start + declaration.length);
  const end = rest.indexOf('\nexport ');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('the record carries the one fact that is not from Fireside', () => {
  it('reads the platform restriction alongside its own counts', () => {
    const record = functionBody(exportSource, 'export async function getAuthorRecord');
    expect(record).toContain('accountRestriction: await readAccountRestriction(userId)');
    expect(exportSource).toContain('getAnyAccountRestriction(userId)');
  });

  it('takes it from platform code rather than from another plugin', () => {
    expect(exportSource).toContain("from 'lib/auth/account-restrictions'");
  });
});

describe('reporting a restriction is not gating on one', () => {
  it('uses the reader that ignores scope, not the one that enforces it', () => {
    // getAccountRestrictionStatus answers "may this member do the thing they are attempting", so it
    // returns not-restricted when the stored scope does not cover that action. An admin needs the
    // opposite: somebody restricted from trading is not blocked from writing and is still an
    // account that has been acted on.
    const anyRestriction = functionBody(
      restrictionsSource,
      'export async function getAnyAccountRestriction',
    );
    expect(anyRestriction).not.toContain('actionScope');
    expect(anyRestriction).not.toContain('covers');

    const gating = functionBody(
      restrictionsSource,
      'export async function getAccountRestrictionStatus',
    );
    expect(gating).toContain('actionScope');
    expect(gating).toContain('const covers =');
  });

  it('keeps the gating reader exported and unchanged in shape', () => {
    expect(restrictionsSource).toContain(
      'export async function getAccountRestrictionStatus(\n  userId: string,\n  actionScope: RestrictionScope,\n)',
    );
  });
});

describe('the admin actually sees it', () => {
  it('flags the row on a restriction, not only on Fireside history', () => {
    const flag = functionBody(queueSource, 'function hasHistory');
    expect(flag).toContain('record.accountRestriction != null');
  });

  it('says the decision was made outside Fireside', () => {
    const line = functionBody(queueSource, 'function RestrictionLine');
    expect(line).toContain('That decision was made outside Fireside.');
    expect(line).toContain('This account is already restricted');
  });

  it('renders nothing at all when there is no restriction', () => {
    const line = functionBody(queueSource, 'function RestrictionLine');
    expect(line).toContain('if (!restriction) return null;');
  });

  it('names the scope in plain words rather than printing the stored value', () => {
    expect(queueSource).toContain('RESTRICTION_SCOPE_LABEL');
    expect(queueSource).toContain('from sending or receiving value');
  });
});
