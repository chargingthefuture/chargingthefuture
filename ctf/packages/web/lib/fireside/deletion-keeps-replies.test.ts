import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Deleting an account removes that member's comments and must leave the replies other members
// wrote under them. The guarantee is in SQL and in the order two steps run, so these tests read the
// sources the way withdrawn-copy.test.ts does rather than faking a database.
const repositorySql = readFileSync(join(__dirname, 'repository.ts'), 'utf8');
const orchestrator = readFileSync(join(__dirname, '..', 'account', 'deletion-orchestrator.ts'), 'utf8');
const schema = readFileSync(join(__dirname, '..', '..', '..', '..', 'schema.sql'), 'utf8');

const withdrawAnswered = repositorySql.slice(
  repositorySql.indexOf('export async function withdrawAnsweredCommentsForDeletion'),
  repositorySql.indexOf('/** Why an edit was refused'),
);

describe('account deletion keeps other members\' replies', () => {
  it('empties an answered comment instead of deleting it, and leaves nothing of its author', () => {
    expect(withdrawAnswered).toContain('UPDATE fireside_comments c');
    expect(withdrawAnswered).not.toContain('DELETE');
    expect(withdrawAnswered).toContain('author_user_id = $2');
    expect(withdrawAnswered).toContain("author_username = ''");
    expect(withdrawAnswered).toContain("body = ''");
    expect(withdrawAnswered).toContain('withdrawn_body = NULL');
    expect(withdrawAnswered).toContain('export_to_blog = FALSE');
  });

  it('only touches the member\'s own comments that somebody else replied to', () => {
    expect(withdrawAnswered).toContain('WHERE c.author_user_id = $1');
    expect(withdrawAnswered).toContain('r.parent_comment_id = c.id AND r.author_user_id <> $1');
  });

  it('runs inside the deletion transaction before the registry plan deletes the rest', () => {
    const steps = orchestrator.slice(
      orchestrator.indexOf('async function runInTransactionSteps'),
      orchestrator.indexOf('export async function deleteServiceScopeData'),
    );
    expect(steps).toContain("slugs.includes('fireside')");
    expect(steps).toContain('withdrawAnsweredCommentsForDeletion(client, userId, DELETED_MEMBER_PLACEHOLDER)');
  });

  it('never cascades a deleted comment into the replies under it', () => {
    expect(schema).toMatch(/parent_comment_id UUID REFERENCES fireside_comments\(id\) ON DELETE SET NULL/);
    expect(schema).not.toMatch(/parent_comment_id UUID REFERENCES fireside_comments\(id\) ON DELETE CASCADE/);
  });
});
