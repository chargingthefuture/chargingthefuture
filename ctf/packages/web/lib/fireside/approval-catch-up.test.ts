import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Telling somebody their comment was answered, for a reply that was held when it was written.
//
// Nothing an unapproved member writes is publicly visible, so a reply of theirs notified nobody at
// the time — telling a person about a reply they would open and not find is worse than telling them
// nothing. The cost was that the notice never arrived at all: the member was approved later, the
// reply appeared, and the person it answered was never told.
//
// These hold the shape of the fix, because what would break it is structural rather than a wrong
// value: a second ping to the same person, a plugin reaching into Unlock, or an approval that fails
// because a notification did.
const catchUpSource = readFileSync(join(__dirname, 'approval-catch-up.ts'), 'utf8');
const repositorySource = readFileSync(join(__dirname, 'repository.ts'), 'utf8');
const webRoot = join(__dirname, '..', '..');
const interfaceSource = readFileSync(
  join(webRoot, 'lib', 'shared', 'unlock-approval-interface.ts'),
  'utf8',
);
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

describe('nobody is told twice', () => {
  it('references the reply’s own id, which is what the write-time notice uses', () => {
    // `notifySafe` dedupes on the event and only pushes when the notification was genuinely new, so
    // the same reference is what makes a re-run, or a re-reviewed account, silent.
    const body = functionBody(catchUpSource, 'export async function announceHeldReplies');
    expect(body).toContain('targetRef: reply.commentId');
    expect(body).toContain("notificationType: 'fireside.reply'");
  });

  it('tells each person once, however many times they were answered', () => {
    // This is what makes running it uncapped safe. The pile-up a cap would guard against only ever
    // happened when many replies landed on the SAME person, and collapsing to one notice each
    // removes it at the source — so nobody is dropped for being answered by somebody prolific.
    const list = functionBody(repositorySource, 'export async function listRepliesAwaitingNotice');
    expect(list).toContain('SELECT DISTINCT ON (parent.author_user_id)');
    expect(list).toContain('ORDER BY parent.author_user_id, c.created_at ASC');
  });

  it('is not capped, so nobody who was answered goes untold', () => {
    const list = functionBody(repositorySource, 'export async function listRepliesAwaitingNotice');
    expect(list).not.toContain('LIMIT');
    expect(list).not.toContain('limit');
    expect(repositorySource).toContain('listRepliesAwaitingNotice(userId: string)');
  });

  it('keeps a fixed reference per person, so a re-run is silent', () => {
    // DISTINCT ON keeps the first row of each group as ORDER BY presents them, so the earliest
    // reply to each person is a stable choice rather than whichever row came back first.
    const list = functionBody(repositorySource, 'export async function listRepliesAwaitingNotice');
    const distinct = list.indexOf('DISTINCT ON (parent.author_user_id)');
    const order = list.indexOf('ORDER BY parent.author_user_id');
    expect(distinct).toBeGreaterThan(0);
    expect(order).toBeGreaterThan(distinct);
  });
});

describe('who is told', () => {
  const list = functionBody(repositorySource, 'export async function listRepliesAwaitingNotice');

  it('is never the member themselves', () => {
    expect(list).toContain('parent.author_user_id <> $1');
  });

  it('is only for a comment still in the conversation', () => {
    // A reply under a comment an admin removed opens a thread the recipient can no longer see
    // properly, so it tells them nothing useful.
    expect(list).toContain("parent.status = 'visible'");
    expect(list).toContain("c.status = 'visible'");
  });

  it('is only about this member’s own replies', () => {
    expect(list).toContain('c.author_user_id = $1');
    expect(list).toContain('JOIN fireside_comments parent ON parent.id = c.parent_comment_id');
  });
});

describe('the plugins stay isolated', () => {
  it('reaches Fireside through the platform interface, never from Unlock’s own code', () => {
    expect(interfaceSource).toContain("from 'lib/fireside/approval-catch-up'");
    expect(reviewRouteSource).toContain("from 'lib/shared/unlock-approval-interface'");
    expect(reviewRouteSource).not.toContain("from 'lib/fireside");
  });

  it('does not let Fireside learn anything about Unlock', () => {
    // The catch-up takes a user id and nothing else: no submission, no review status, no tier.
    expect(catchUpSource).not.toContain('lib/unlock');
    expect(catchUpSource).toContain('announceHeldReplies(userId: string)');
  });

  it('records people told, not replies found', () => {
    // The audit row's number has to mean what an admin would read it as.
    expect(interfaceSource).toContain('firesidePeopleTold');
    expect(interfaceSource).not.toContain('firesideRepliesAnnounced');
  });
});

describe('an approval never fails because a notice did', () => {
  it('catches the plugin’s failure in the interface and reports it', () => {
    const run = functionBody(interfaceSource, 'export async function runUnlockApprovalCatchUp');
    expect(run).toContain('try {');
    expect(run).toContain('reportError(');
  });

  it('runs only on an approval, and after the decision is already committed', () => {
    const catchUp = functionBody(reviewRouteSource, 'async function catchUpPluginsOnApproval');
    expect(catchUp).toContain("if (input.reviewStatus !== 'approved') {");
    const decided = reviewRouteSource.indexOf('await reviewUnlockSubmission(');
    const calledFromPost = reviewRouteSource.indexOf('await catchUpPluginsOnApproval({');
    expect(decided).toBeGreaterThan(0);
    expect(calledFromPost).toBeGreaterThan(decided);
  });

  it('records what it did, because it happened to somebody else’s account', () => {
    expect(reviewRouteSource).toContain("command: 'unlock.admin.submission.approval_catch_up'");
  });
});
