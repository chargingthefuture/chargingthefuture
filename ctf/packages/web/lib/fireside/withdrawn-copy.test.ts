import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The author's copy of a comment they took down is the one field on a Fireside row that is meant
// for exactly one person. These tests read the SQL the repository is built from, because the
// guarantee is structural — which select carries the column — rather than something a unit test
// with a fake database would notice.
const repositorySql = readFileSync(join(__dirname, 'repository.ts'), 'utf8');
const exportSql = readFileSync(join(__dirname, 'export-review.ts'), 'utf8');

describe('withdrawn_body stays with its author', () => {
  it('is not in the select that feeds the public thread read', () => {
    const columns = repositorySql.slice(
      repositorySql.indexOf('const COMMENT_COLUMNS'),
      repositorySql.indexOf('const COMMENT_FROM'),
    );
    expect(columns).not.toContain('withdrawn_body');
  });

  it('is in the author-scoped select, which is the only place it may be', () => {
    const own = repositorySql.slice(
      repositorySql.indexOf('const OWN_COMMENT_SELECT'),
      repositorySql.indexOf('function toComment'),
    );
    expect(own).toContain('withdrawn_body');
  });

  it('is read by exactly one query, and that query is scoped to the caller', () => {
    // Counts where it is interpolated into a query, not where the name is mentioned in a comment.
    const uses = repositorySql.split('${OWN_COMMENT_SELECT}').length - 1;
    expect(uses).toBe(1);
    const listOwn = repositorySql.slice(repositorySql.indexOf('export async function listOwnComments'));
    expect(listOwn).toContain('WHERE c.author_user_id = $1');
  });

  it('is null on the admin read, which has no column to read it from', () => {
    // The admin list of every comment builds the same shape as the author's own list. It must not
    // carry the author's private copy, and the select behind it does not contain the column — so
    // this is a hard null rather than a filter somebody could later relax.
    const listRecent = repositorySql.slice(
      repositorySql.indexOf('export async function listRecentComments'),
      repositorySql.indexOf('export async function countAllComments'),
    );
    expect(listRecent).toContain('withdrawnBody: null');
    expect(listRecent).toContain('${COMMENT_SELECT}');
    expect(listRecent).not.toContain('OWN_COMMENT_SELECT');
  });

  it('never reaches the blog export feed', () => {
    expect(exportSql).not.toContain('withdrawn_body');
  });

  it('is filled from the row rather than from anything a caller sends', () => {
    const withdraw = repositorySql.slice(
      repositorySql.indexOf('export async function withdrawOwnComment'),
      repositorySql.indexOf('export async function toggleReaction'),
    );
    expect(withdraw).toContain('withdrawn_body = COALESCE(NULLIF(body, \'\'), withdrawn_body)');
    // Scoped to the author, so nobody can take down somebody else's comment and keep a copy.
    expect(withdraw).toContain('author_user_id = $2');
  });
});
