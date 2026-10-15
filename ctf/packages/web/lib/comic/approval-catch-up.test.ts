import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Granting the credits for knowledge library writing accepted before the member was verified.
//
// Only a verified member receives the credits, so writing accepted while the member was still in
// Unlock stayed accepted with nothing granted, and nothing ever granted it later (issue #2678).
// These hold the shape of the fix: what would break it is structural rather than a wrong value —
// a second grant, a plugin reaching into Unlock, or an approval that fails because a grant did.
const webRoot = join(__dirname, '..', '..');
const catchUpSource = readFileSync(join(__dirname, 'approval-catch-up.ts'), 'utf8');
const grantSource = readFileSync(join(__dirname, 'contribution-grant.ts'), 'utf8');
const repositorySource = readFileSync(join(__dirname, 'contribution-repository.ts'), 'utf8');
const interfaceSource = readFileSync(join(webRoot, 'lib', 'shared', 'unlock-approval-interface.ts'), 'utf8');
const reviewRouteSource = readFileSync(
  join(webRoot, 'app', 'api', 'unlock', 'admin', 'submissions', '[submissionId]', 'review', 'route.ts'),
  'utf8',
);

/** Where a named function's source starts, so a test reads that function and not the file. */
function functionBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  expect(start, `${declaration} is not in this file`).toBeGreaterThan(-1);
  const rest = source.slice(start + declaration.length);
  const end = rest.indexOf('\nexport ');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('only writing that is owed credits is granted', () => {
  const list = functionBody(repositorySource, 'export async function listUngrantedAcceptedContributionIds');

  it('reads only this member’s accepted, ungranted contributions', () => {
    expect(list).toContain('user_id = $1');
    expect(list).toContain("status = 'accepted'");
    expect(list).toContain('granted_at IS NULL');
  });

  it('grants through the same function the accept route uses, so the same checks apply', () => {
    const body = functionBody(catchUpSource, 'export async function grantHeldContributionCredits');
    expect(body).toContain('grantContributionRecognition(');
    expect(catchUpSource).not.toContain('mintGrant');
  });
});

describe('nothing is granted twice', () => {
  it('stamps before minting and keys the mint on the contribution', () => {
    const grant = functionBody(grantSource, 'export async function grantContributionRecognition');
    expect(grant.indexOf('markContributionGranted(')).toBeGreaterThan(-1);
    expect(grant.indexOf('markContributionGranted(')).toBeLessThan(grant.indexOf('mintGrant('));
    expect(grant).toContain('idempotencyKey: `comic-contribution-${input.contributionId}`');
  });

  it('clears the stamp only when the mint throws, so the grant can be tried again', () => {
    const grant = functionBody(grantSource, 'export async function grantContributionRecognition');
    const catchAt = grant.indexOf('} catch (error) {');
    expect(catchAt).toBeGreaterThan(grant.indexOf('mintGrant('));
    expect(grant.slice(catchAt)).toContain('clearContributionGranted(input.contributionId)');
  });
});

describe('the plugins stay isolated, and an approval never fails because a grant did', () => {
  it('reaches the comic plugin through the platform interface only', () => {
    expect(interfaceSource).toContain("from 'lib/comic/approval-catch-up'");
    expect(reviewRouteSource).not.toContain("from 'lib/comic");
    expect(catchUpSource).not.toContain('lib/unlock');
  });

  it('catches the grant’s failure in the interface and reports it', () => {
    const run = functionBody(interfaceSource, 'export async function runUnlockApprovalCatchUp');
    const at = run.indexOf('grantHeldContributionCredits(');
    expect(at).toBeGreaterThan(-1);
    expect(run.slice(0, at).lastIndexOf('try {')).toBeGreaterThan(-1);
    expect(run).toContain("op: 'comic_held_contribution_credits'");
  });

  it('records the approving admin as the grant’s actor', () => {
    expect(reviewRouteSource).toContain('runUnlockApprovalCatchUp(input.targetUserId, input.actorUserId)');
  });
});
